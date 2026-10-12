import { requireEnv } from "./env.js";

let authPromise = null;

/** firebase-admin is loaded on first use only (it is large and only needed for Google sign-in). */
const getFirebaseAuth = () => {
  if (!authPromise) {
    authPromise = (async () => {
      const { initializeApp, cert, getApps } = await import("firebase-admin/app");
      const { getAuth } = await import("firebase-admin/auth");
      const app =
        getApps()[0] ||
        initializeApp({
          credential: cert({
            projectId: requireEnv("FIREBASE_PROJECT_ID"),
            clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
            // .env files store the PEM key with literal "\n" sequences.
            privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
          }),
        });
      return getAuth(app);
    })().catch((error) => {
      authPromise = null;
      throw error;
    });
  }
  return authPromise;
};

/**
 * Indirection so tests can replace the verifier without network access.
 * Production code must call `firebaseVerifier.verifyIdToken`.
 */
export const firebaseVerifier = {
  // checkRevoked=true: tokens of disabled/revoked Firebase users are refused.
  verifyIdToken: async (idToken) => (await getFirebaseAuth()).verifyIdToken(idToken, true),
};
