import request from "supertest";
import app from "../app.js";
import { catalogKeys, LANGUAGES, translate } from "../helper/i18n.js";
import { extractTextWithMethod, ocrFallback } from "../helper/textProcessor.js";
import { pool, resetDatabase, createUser, createAssessment, auth, installFakes, flushEmails } from "./helpers.js";

let fakes;

beforeEach(async () => {
  await resetDatabase();
  fakes = installFakes();
});

afterAll(async () => {
  await pool.end();
});

describe("server translations", () => {
  test("every language has exactly the English keys", () => {
    const en = catalogKeys("en");
    for (const language of LANGUAGES) expect(catalogKeys(language)).toEqual(en);
  });

  test("placeholders are filled and unknown languages fall back to English", () => {
    expect(translate("ur", "email.enrolled.subject", { title: "حیاتیات" })).toBe("نیا امتحان: حیاتیات");
    expect(translate("xx", "role.student")).toBe("Student");
  });
});

describe("language preference", () => {
  test("a user can set their own language; invalid values are rejected", async () => {
    const user = await createUser({ role: "student" });
    const ok = await request(app).put("/api/auth/me/language").set("Authorization", auth(user)).send({ language: "ur" });
    expect(ok.status).toBe(200);
    expect(ok.body.data.language).toBe("ur");
    const { rows } = await pool.query("SELECT language_preference FROM users WHERE id = $1", [user.id]);
    expect(rows[0].language_preference).toBe("ur");
    expect((await request(app).put("/api/auth/me/language").set("Authorization", auth(user)).send({ language: "de" })).status).toBe(400);
  });

  test("the database only accepts supported languages", async () => {
    const user = await createUser();
    await expect(pool.query("UPDATE users SET language_preference = 'de' WHERE id = $1", [user.id])).rejects.toThrow(/chk_users_language_preference/);
  });
});

describe("emails in the recipient's language", () => {
  test("an Urdu-speaking student gets an Urdu, right-to-left enrollment email", async () => {
    const instructor = await createUser({ role: "instructor", name: "Teacher Ali" });
    const student = await createUser({ role: "student", name: "Sara" });
    await pool.query("UPDATE users SET language_preference = 'ur' WHERE id = $1", [student.id]);
    const assessment = await createAssessment(instructor);
    const res = await request(app).post(`/api/assessments/${assessment.id}/enroll`).set("Authorization", auth(instructor)).send({ email: student.email });
    expect(res.status).toBe(200);
    await flushEmails();
    const mail = fakes.sentEmails.find((m) => m.to === student.email);
    expect(mail.subject).toBe("نیا امتحان: Sample");
    expect(mail.html).toContain('dir="rtl"');
    expect(mail.html).toContain('lang="ur"');
    expect(mail.html).toContain("Noto Nastaliq Urdu");
    expect(mail.html).toContain("Teacher Ali");
  });

  test("sign-up in Arabic stores the language and sends an Arabic verification email", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Omar", email: "omar@test.io", password: "Passw0rdGood", language: "ar", captchaToken: "x" });
    expect(res.status).toBe(201);
    await flushEmails();
    const mail = fakes.sentEmails.find((m) => m.to === "omar@test.io");
    expect(mail.subject).toBe("تأكيد بريدك الإلكتروني - Gradix");
    const { rows } = await pool.query("SELECT language_preference FROM users WHERE email = 'omar@test.io'");
    expect(rows[0].language_preference).toBe("ar");
  });

  test("injected HTML in a name stays escaped in every language", async () => {
    const instructor = await createUser({ role: "instructor", name: "<script>x</script>" });
    const student = await createUser({ role: "student" });
    await pool.query("UPDATE users SET language_preference = 'fa' WHERE id = $1", [student.id]);
    const assessment = await createAssessment(instructor);
    await request(app).post(`/api/assessments/${assessment.id}/enroll`).set("Authorization", auth(instructor)).send({ email: student.email });
    await flushEmails();
    const mail = fakes.sentEmails.find((m) => m.to === student.email);
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });
});

describe("OCR path", () => {
  const original = { ...ocrFallback };
  afterEach(() => Object.assign(ocrFallback, original));

  test("plain text reports its extraction method", async () => {
    const { method } = await extractTextWithMethod(Buffer.from("A short poem about the sea and the sky"), "text/plain");
    expect(method).toBe("text");
  });

  test("when Tesseract output is unusable and the flag is on, the Gemini transcription is used and labelled", async () => {
    ocrFallback.enabled = () => true;
    ocrFallback.transcribe = async () => "پودے سورج کی روشنی سے اپنی خوراک بناتے ہیں۔";
    // A blank 1x1 PNG: Tesseract finds no text.
    const blank = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
      "base64"
    );
    const result = await extractTextWithMethod(blank, "image/png");
    expect(result).toEqual({ text: "پودے سورج کی روشنی سے اپنی خوراک بناتے ہیں۔", method: "ocr_gemini" });
  }, 60000);

  test("with the flag off an unreadable scan is still a clear 422", async () => {
    ocrFallback.enabled = () => false;
    const blank = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
      "base64"
    );
    await expect(extractTextWithMethod(blank, "image/png")).rejects.toMatchObject({ status: 422 });
  }, 60000);

  test("the extraction method is stored on the resource", async () => {
    const instructor = await createUser({ role: "instructor" });
    const res = await request(app)
      .post("/api/resources")
      .set("Authorization", auth(instructor))
      .attach("files", Buffer.from("Plants make food from light and water every day."), { filename: "n.txt", contentType: "text/plain" });
    expect(res.status).toBe(201);
    const { rows } = await pool.query("SELECT extraction_method FROM resources");
    expect(rows[0].extraction_method).toBe("text");
  });
});
