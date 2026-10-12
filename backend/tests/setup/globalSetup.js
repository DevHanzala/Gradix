import { startTestDatabase } from "./testDatabase.js";

/**
 * Runs once before all test files (in the same process with --runInBand).
 * Never touches the developer's real database: every PG* variable is
 * overwritten to point at the test database before any app module loads.
 */
export default async function globalSetup() {
  Object.assign(process.env, {
    NODE_ENV: "test",
    JWT_SECRET: "test-jwt-secret-not-for-production",
    FRONTEND_URL: "http://localhost:5173",
    EMAIL_USER: "noreply@example.com",
    EMAIL_PASS: "unused",
    RECAPTCHA_SECRET_KEY: "unused",
    FIREBASE_PROJECT_ID: "test",
    FIREBASE_CLIENT_EMAIL: "test@example.com",
    FIREBASE_PRIVATE_KEY: "unused",
    GEMINI_CREATION_API_KEY_1: "unused",
    GEMINI_CHECKING_API_KEY: "unused",
    // Present-but-empty so dotenv never loads real keys from a developer .env.
    GEMINI_CREATION_API_KEY_2: "",
    GROQ_API_KEY: "",
    TRUST_PROXY: "",
  });
  globalThis.__stopTestDatabase__ = await startTestDatabase();
}
