import {
  normalizeText,
  canonicalOptionIndex,
  canonicalStudentAnswer,
  gradeAnswer,
  isAnswerCorrect,
  parseBoolean,
  decodeStoredValue,
} from "../utils/grading.js";
import { normalizeGeneratedQuestion } from "../models/assessmentModel.js";

const mcq = (correct, options = ["Paris", "Rome", "Madrid", "Berlin"]) => ({
  question_type: "multiple_choice",
  options,
  correct_answer: correct,
  positive_marks: 2,
  negative_marks: 0.5,
});

describe("scoring: positive / negative / unanswered", () => {
  test("correct answer earns the positive marks", () => {
    expect(gradeAnswer(mcq("Paris"), "Paris")).toEqual({ answered: true, correct: true, score: 2 });
  });

  test("wrong answer deducts the negative marks", () => {
    expect(gradeAnswer(mcq("Paris"), "Rome")).toEqual({ answered: true, correct: false, score: -0.5 });
  });

  test("unanswered scores zero (null, empty, whitespace)", () => {
    for (const blank of [null, undefined, "", "   "]) {
      expect(gradeAnswer(mcq("Paris"), blank)).toEqual({ answered: false, correct: false, score: 0 });
    }
  });

  test("negative marks are always deducted, even if stored as a negative number", () => {
    expect(gradeAnswer({ ...mcq("Paris"), negative_marks: -1 }, "Rome").score).toBe(-1);
  });
});

describe("MCQ canonical matching", () => {
  const options = ["Paris", "Rome", "Madrid", "Berlin"];

  test.each([["B"], ["b"], ["B."], ["(B)"], ["B)"], ["B. Rome"], ["Rome"], ["  rome "], [1]])(
    "%p maps to option B",
    (answer) => {
      expect(canonicalOptionIndex(answer, options)).toBe(1);
    }
  );

  test("labelled options and legacy JSON-encoded answers are understood", () => {
    expect(canonicalOptionIndex('"B. Rome"', ["A. Paris", "B. Rome"])).toBe(1);
    expect(canonicalOptionIndex("A", { A: "Paris", B: "Rome" })).toBe(0);
  });

  test("an option text that starts with a letter still matches exactly", () => {
    expect(canonicalOptionIndex("A cat", ["A cat", "A dog"])).toBe(0);
  });

  test("unknown answers do not match", () => {
    expect(canonicalOptionIndex("Z", options)).toBeNull();
    expect(canonicalOptionIndex("London", options)).toBeNull();
  });

  test("letter, labelled and text forms of the right answer all grade as correct", () => {
    for (const form of ["A", "A.", "A. Paris", "paris"]) {
      expect(isAnswerCorrect(mcq("A"), form)).toBe(true);
    }
    expect(canonicalStudentAnswer(mcq("A"), "a")).toBe("Paris");
  });
});

describe("Unicode-safe grading (Urdu / Arabic / Persian)", () => {
  test("normalizeText keeps non-Latin letters and strips punctuation", () => {
    expect(normalizeText("  اسلام آباد۔ ")).toBe("اسلام آباد");
    expect(normalizeText("مرحبا، يا عالم!")).toBe("مرحبا يا عالم");
    expect(normalizeText("کتاب")).not.toBe("");
  });

  test("Urdu MCQ: right and wrong answers are distinguished", () => {
    const q = mcq("اسلام آباد", ["لاہور", "اسلام آباد", "کراچی", "پشاور"]);
    expect(isAnswerCorrect(q, "اسلام آباد")).toBe(true);
    expect(isAnswerCorrect(q, "کراچی")).toBe(false);
    expect(isAnswerCorrect(q, "B")).toBe(true);
  });

  test("Arabic answers with tatweel and punctuation still match", () => {
    const q = mcq("القاهرة", ["القاهرة", "الرياض"]);
    expect(isAnswerCorrect(q, "القـاهرة.")).toBe(true);
    expect(isAnswerCorrect(q, "الرياض")).toBe(false);
  });

  test("Persian NFC/NFD forms compare equal", () => {
    const composed = "آب".normalize("NFC");
    const decomposed = "آب".normalize("NFD");
    expect(composed).not.toBe(decomposed);
    expect(isAnswerCorrect(mcq(composed, [composed, "نان"]), decomposed)).toBe(true);
  });

  test("short answers in Urdu are graded, not auto-accepted", () => {
    const q = {
      question_type: "short_answer",
      correct_answer: { answer: "فوٹو سنتھیسس", required_keywords: ["فوٹو", "سنتھیسس"], min_required_match: 2 },
      positive_marks: 1,
      negative_marks: 0,
    };
    expect(isAnswerCorrect(q, "یہ فوٹو سنتھیسس ہے")).toBe(true);
    expect(isAnswerCorrect(q, "مجھے نہیں معلوم")).toBe(false);
  });
});

describe("true/false", () => {
  test("booleans, strings and localized words are parsed", () => {
    expect(parseBoolean(true)).toBe(true);
    expect(parseBoolean("False")).toBe(false);
    expect(parseBoolean("درست")).toBe(true);
    expect(parseBoolean("غلط")).toBe(false);
    expect(parseBoolean("صحيح")).toBe(true);
    expect(parseBoolean("maybe")).toBeNull();
  });

  test("grading works across forms", () => {
    const q = { question_type: "true_false", correct_answer: true, positive_marks: 1, negative_marks: 0 };
    expect(isAnswerCorrect(q, "true")).toBe(true);
    expect(isAnswerCorrect(q, false)).toBe(false);
  });
});

describe("short answer safety", () => {
  const base = { question_type: "short_answer", positive_marks: 1, negative_marks: 0 };

  test("a plain-string rule is compared as text (no JSON.parse crash)", () => {
    const q = { ...base, correct_answer: "Paris" };
    expect(() => isAnswerCorrect(q, "paris")).not.toThrow();
    expect(isAnswerCorrect(q, "It is Paris")).toBe(true);
    expect(isAnswerCorrect(q, "Rome")).toBe(false);
  });

  test("an empty keyword list does NOT mark every answer correct", () => {
    expect(isAnswerCorrect({ ...base, correct_answer: { required_keywords: [] } }, "anything")).toBe(false);
    expect(isAnswerCorrect({ ...base, correct_answer: null }, "anything")).toBe(false);
  });

  test("decodeStoredValue only decodes real JSON", () => {
    expect(decodeStoredValue('"x"')).toBe("x");
    expect(decodeStoredValue("Paris")).toBe("Paris");
    expect(decodeStoredValue("{not json")).toBe("{not json");
  });
});

describe("generated question normalization", () => {
  const block = { question_type: "multiple_choice", positive_marks: 1, negative_marks: 0, duration_per_question: 60 };

  test("letter answers become the option text and labels are stripped", () => {
    const q = normalizeGeneratedQuestion(
      { question_text: "Capital?", options: ["A. Paris", "B. Rome"], correct_answer: "B" },
      block
    );
    expect(q.options).toEqual(["Paris", "Rome"]);
    expect(q.correct_answer).toBe("Rome");
  });

  test("questions whose answer is not an option are rejected", () => {
    expect(normalizeGeneratedQuestion({ question_text: "Q", options: ["a", "b"], correct_answer: "z" }, block)).toBeNull();
  });
});
