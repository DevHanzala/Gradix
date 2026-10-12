import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { requireEnv } from "./env.js";

const getFirebaseApp = () => {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: requireEnv("FIREBASE_PROJECT_ID"),
      clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
      // .env files store the PEM key with literal "\n" sequences.
      privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
};

/**
 * Indirection so tests can replace the verifier without network access.
 * Production code must call `firebaseVerifier.verifyIdToken`.
 */
export const firebaseVerifier = {
  verifyIdToken: async (idToken) => getAuth(getFirebaseApp()).verifyIdToken(idToken, true),
};
