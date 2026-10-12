import dotenv from "dotenv";

dotenv.config();

/**
 * Environment variables the server cannot run without.
 * Keep this list in sync with .env.example.
 */
export const REQUIRED_ENV = [
  // Database
  "PGHOST",
  "PGDATABASE",
  "PGUSER",
  "PGPASSWORD",
  // Auth
  "JWT_SECRET",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "RECAPTCHA_SECRET_KEY",
  // App
  "FRONTEND_URL",
  // Email
  "EMAIL_USER",
  "EMAIL_PASS",
  // AI
  "GEMINI_CREATION_API_KEY_1",
  "GEMINI_CHECKING_API_KEY",
];

/**
 * Throws one error listing every missing variable, so a misconfigured
 * deployment fails at boot instead of on the first request that needs it.
 */
export const validateEnv = (env = process.env, required = REQUIRED_ENV) => {
  const missing = required.filter((key) => !env[key] || !String(env[key]).trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Copy .env.example to .env and fill them in."
    );
  }
};

/** Read one required variable, failing with a clear message if it is absent. */
export const requireEnv = (key) => {
  const value = process.env[key];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};
