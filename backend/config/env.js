import dotenv from "dotenv";
import { hasGeminiKey } from "../services/ai/aiProviders.js";

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
];

/**
 * Requirements that one of several variables can satisfy, as [description, check(env)].
 * The description is what the startup error names.
 */
export const REQUIRED_ANY = [
  [
    "a Gemini key (GEMINI_API_KEYS, GEMINI_CREATION_API_KEY_1 or GEMINI_API_KEY)",
    (env) => hasGeminiKey(env),
  ],
];

/**
 * Throws one error listing every missing variable, so a misconfigured
 * deployment fails at boot instead of on the first request that needs it.
 */
export const validateEnv = (env = process.env, required = REQUIRED_ENV, requiredAny = REQUIRED_ANY) => {
  const missing = [
    ...required.filter((key) => !env[key] || !String(env[key]).trim()),
    ...requiredAny.filter(([, check]) => !check(env)).map(([description]) => description),
  ];
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
