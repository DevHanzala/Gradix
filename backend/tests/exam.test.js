import request from "supertest";
import app from "../app.js";
import { GRACE_MS } from "../services/studentAssessment.service.js";
import {
  pool,
  resetDatabase,
  createUser,
  createAssessment,
  enroll,
  auth,
  installFakes,
  shiftAttemptTime,
} from "./helpers.js";

let fakes;
let instructor;
let student;
let assessment;

const startExam = (user = student, id = assessment.id, language = "en") =>
  request(app).post(`/api/taking/assessments/${id}/start`).set("Authorization", auth(user)).send({ language });
const saveAnswer = (attemptId, questionId, answer, user = student) =>
  request(app).put(`/api/taking/attempts/${attemptId}/answers/${questionId}`).set("Authorization", auth(user)).send({ answer });
const advance = (attemptId, fromIndex, user = student) =>
  request(app).post(`/api/taking/attempts/${attemptId}/advance`).set("Authorization", auth(user)).send({ fromIndex });
const submit = (attemptId, answers = [], user = student) =>
  request(app)
    .post(`/api/taking/assessments/${assessment.id}/submit`)
    .set("Authorization", auth(user))
    .send({ attemptId, answers });
const getState = (user = student) =>
  request(app).get(`/api/taking/assessments/${assessment.id}/attempt`).set("Authorization", auth(user));
/** Ids of all questions of an attempt (for tests that need a not-yet-served id). */
const questionIds = async (attemptId) =>
  (await pool.query("SELECT id FROM generated_questions WHERE attempt_id = $1 ORDER BY question_order", [attemptId])).rows.map((r) => r.id);

beforeEach(async () => {
  await resetDatabase();
  fakes = installFakes();
  instructor = await createUser({ role: "instructor" });
  student = await createUser({ role: "student" });
  assessment = await createAssessment(instructor, [
    { type: "multiple_choice", count: 2, duration: 60, positive: 2, negative: 0.5 },
    { type: "true_false", count: 1, duration: 60, positive: 1, negative: 0 },
  ], { status: "published" });
  await enroll(assessment, student);
});

afterAll(async () => {
  await pool.end();
});

describe("answer-leak check", () => {
  test("/start, resume and autosave responses never contain correct answers", async () => {
    const started = await startExam();
    expect(started.status).toBe(200);
    const body = JSON.stringify(started.body);
    expect(body).not.toMatch(/correct_answer|correctAnswer/);
    expect(body).not.toContain('"is_correct"');

    const { attemptId, question } = started.body.data;
    const saved = await saveAnswer(attemptId, question.id, "Paris");
    expect(JSON.stringify(saved.body)).not.toMatch(/correct/i);

    const resumed = await getState();
    expect(JSON.stringify(resumed.body)).not.toMatch(/correct_answer|correctAnswer/);
  });

  test("submission details are not available while the attempt is in progress", async () => {
    const { attemptId } = (await startExam()).body.data;
    const res = await request(app).get(`/api/taking/submissions/${attemptId}`).set("Authorization", auth(student));
    expect(res.status).toBe(404);
  });

  test("only the current question is sent; later questions never reach the browser", async () => {
    const started = (await startExam()).body.data;
    expect(started.questions).toBeUndefined();
    expect(started.totalQuestions).toBe(3);
    const ids = await questionIds(started.attemptId);
    expect(JSON.stringify(started)).not.toContain(`"id":${ids[1]}`);
    // A later question cannot be answered before it is served.
    const early = await saveAnswer(started.attemptId, ids[1], "4");
    expect(early.status).toBe(409);
    expect(early.body.code).toBe("QUESTION_NOT_OPEN");
  });

  test("options are sent without letter labels", async () => {
    const { question } = (await startExam()).body.data;
    expect(question.options).toEqual(["Paris", "Rome", "Madrid", "Berlin"]);
  });
});

describe("one attempt per student", () => {
  test("Start after completing returns 409 ALREADY_ATTEMPTED", async () => {
    const { attemptId } = (await startExam()).body.data;
    expect((await submit(attemptId)).status).toBe(200);

    const again = await startExam();
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("ALREADY_ATTEMPTED");
  });

  test("the database refuses a second online attempt", async () => {
    await startExam();
    await expect(
      pool.query(`INSERT INTO assessment_attempts (student_id, assessment_id) VALUES ($1, $2)`, [student.id, assessment.id])
    ).rejects.toThrow(/uq_attempts_one_online_per_student/);
  });

  test("physical-paper rows do not count as an online attempt", async () => {
    await pool.query(
      `INSERT INTO assessment_attempts (student_id, assessment_id, is_physical_paper, status) VALUES ($1, $2, TRUE, 'completed')`,
      [student.id, assessment.id]
    );
    expect((await startExam()).status).toBe(200);
  });

  test("the dashboard list reports completed status, never 'not_started' after submitting", async () => {
    const { attemptId } = (await startExam()).body.data;
    await submit(attemptId);
    const list = await request(app).get("/api/student-analytics/assessments").set("Authorization", auth(student));
    expect(list.body.data[0].status).toBe("completed");
  });
});

describe("resume", () => {
  test("Start while in progress resumes the same attempt with saved answers", async () => {
    const first = (await startExam()).body.data;
    await saveAnswer(first.attemptId, first.question.id, "b. rome");

    const second = await startExam();
    expect(second.status).toBe(200);
    expect(second.body.code).toBe("IN_PROGRESS");
    expect(second.body.data.attemptId).toBe(first.attemptId);
    expect(second.body.data.question.id).toBe(first.question.id);
    // Stored in canonical form.
    expect(second.body.data.savedAnswer).toBe("Rome");
  });

  test("GET attempt state reports index and remaining time", async () => {
    const { attemptId } = (await startExam()).body.data;
    await advance(attemptId, 0);
    const state = (await getState()).body.data;
    expect(state.status).toBe("in_progress");
    expect(state.currentQuestionIndex).toBe(1);
    expect(state.totalDurationSeconds).toBe(180);
    expect(state.remainingSeconds).toBeLessThanOrEqual(120);
  });

  test("a failed generation leaves no attempt behind, so the student can retry", async () => {
    fakes.aiQuestions = "not json";
    const failed = await startExam();
    expect(failed.status).toBe(503);
    expect(failed.body.code).toBe("GENERATION_FAILED");
    const { rows } = await pool.query(`SELECT count(*)::int AS c FROM assessment_attempts`);
    expect(rows[0].c).toBe(0);

    fakes.aiQuestions = (await import("./helpers.js")).MCQ_QUESTIONS;
    expect((await startExam()).status).toBe(200);
  });
});

describe("timer validation", () => {
  test("answers for a passed question are rejected (QUESTION_CLOSED)", async () => {
    const { attemptId, question } = (await startExam()).body.data;
    await advance(attemptId, 0);
    const late = await saveAnswer(attemptId, question.id, "Paris");
    expect(late.status).toBe(409);
    expect(late.body.code).toBe("QUESTION_CLOSED");
  });

  test("the server moves on when a question's time (plus grace) has elapsed", async () => {
    const { attemptId, question } = (await startExam()).body.data;
    await shiftAttemptTime(attemptId, 60 + GRACE_MS / 1000 + 1);
    const res = await saveAnswer(attemptId, question.id, "Paris");
    expect(res.body.code).toBe("QUESTION_CLOSED");
    const state = (await getState()).body.data;
    expect(state.currentQuestionIndex).toBe(1);
    expect((await saveAnswer(attemptId, state.question.id, "4")).status).toBe(200);
  });

  test("an answer inside the grace period is still accepted", async () => {
    const { attemptId, question } = (await startExam()).body.data;
    await shiftAttemptTime(attemptId, 60);
    expect((await saveAnswer(attemptId, question.id, "Paris")).status).toBe(200);
  });

  test("once total time is over the attempt is closed and graded automatically", async () => {
    const { attemptId, question } = (await startExam()).body.data;
    await saveAnswer(attemptId, question.id, "Paris");
    await shiftAttemptTime(attemptId, 180 + 10);

    const late = await saveAnswer(attemptId, (await questionIds(attemptId))[1], "4");
    expect(late.status).toBe(409);
    expect(late.body.code).toBe("ATTEMPT_CLOSED");

    const state = (await getState()).body.data;
    expect(state.status).toBe("completed");
    expect(state.correctCount).toBe(1);
  });

  test("submit ignores answers whose window has closed", async () => {
    const { attemptId, question } = (await startExam()).body.data;
    await advance(attemptId, 0);
    const res = await submit(attemptId, [{ questionId: question.id, answer: "Paris" }]);
    expect(res.status).toBe(200);
    expect(res.body.data.rejectedAnswers).toBe(1);
    expect(res.body.data.unansweredCount).toBe(3);
  });
});

describe("scoring end to end", () => {
  test("positive, negative and unanswered are all applied", async () => {
    const { attemptId, question } = (await startExam()).body.data;
    await saveAnswer(attemptId, question.id, "A"); // correct: +2
    const second = (await advance(attemptId, 0)).body.data;
    await saveAnswer(attemptId, second.question.id, "3"); // wrong: -0.5
    // question 3 unanswered: 0
    const res = await submit(attemptId);
    expect(res.body.data).toMatchObject({
      score: 1.5,
      totalMarks: 5,
      correctCount: 1,
      incorrectCount: 1,
      unansweredCount: 1,
      percentage: 30,
    });
  });

  test("a negative total is floored at zero", async () => {
    const { attemptId, question } = (await startExam()).body.data;
    await saveAnswer(attemptId, question.id, "Rome");
    const res = await submit(attemptId);
    expect(res.body.data.score).toBe(0);
  });

  test("Urdu answers are graded and counted correctly in analytics", async () => {
    fakes.aiQuestions = [
      { question_type: "multiple_choice", question_text: "پاکستان کا دارالحکومت؟", options: ["لاہور", "اسلام آباد", "کراچی", "پشاور"], correct_answer: "B" },
      { question_type: "multiple_choice", question_text: "سورج کہاں سے نکلتا ہے؟", options: ["مشرق", "مغرب", "شمال", "جنوب"], correct_answer: "مشرق" },
      { question_type: "true_false", question_text: "پانی گیلا ہے", options: null, correct_answer: "درست" },
    ];
    const { attemptId, question } = (await startExam(student, assessment.id, "ur")).body.data;
    await saveAnswer(attemptId, question.id, "اسلام آباد");
    const second = (await advance(attemptId, 0)).body.data.question;
    await saveAnswer(attemptId, second.id, "مغرب");
    const third = (await advance(attemptId, 1)).body.data.question;
    await saveAnswer(attemptId, third.id, true);
    const result = (await submit(attemptId)).body.data;
    expect(result.correctCount).toBe(2);
    expect(result.incorrectCount).toBe(1);

    const details = await request(app)
      .get(`/api/student-analytics/assessment/${assessment.id}`)
      .set("Authorization", auth(student));
    expect(details.body.data.correct_answers).toBe(2);
    expect(details.body.data.incorrect_answers).toBe(1);

    const review = await request(app)
      .get(`/api/student-analytics/assessment/${assessment.id}/questions`)
      .set("Authorization", auth(student));
    expect(review.body.data.map((q) => q.is_correct)).toEqual([true, false, true]);
  });
});

describe("access rules for attempts", () => {
  test("another student cannot read or write someone else's attempt", async () => {
    const other = await createUser({ role: "student" });
    const { attemptId, question } = (await startExam()).body.data;
    expect((await saveAnswer(attemptId, question.id, "Paris", other)).status).toBe(404);
    await submit(attemptId);
    const res = await request(app).get(`/api/taking/submissions/${attemptId}`).set("Authorization", auth(other));
    expect(res.status).toBe(404);
  });

  test("an unenrolled student cannot start, and the assessment is not marked executed", async () => {
    const outsider = await createUser({ role: "student" });
    const res = await startExam(outsider);
    expect(res.status).toBe(403);
    const { rows } = await pool.query(`SELECT is_executed FROM assessments WHERE id = $1`, [assessment.id]);
    expect(rows[0].is_executed).toBe(false);
  });

  test("starting marks the assessment as executed", async () => {
    await startExam();
    const { rows } = await pool.query(`SELECT is_executed FROM assessments WHERE id = $1`, [assessment.id]);
    expect(rows[0].is_executed).toBe(true);
  });
});
