import crypto from "k6/crypto";
import encoding from "k6/encoding";

/** HS256 login token for a demo user (same secret as demoServer.mjs; never a real secret). */
export const DEMO_SECRET = "demo-jwt-secret-not-for-production";
const b64 = (obj) => encoding.b64encode(JSON.stringify(obj), "rawurl");

export const tokenFor = (user) => {
  const data = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ id: user.id, email: user.email, role: user.role, iat: Math.floor(Date.now() / 1000) })}`;
  return `${data}.${crypto.hmac("sha256", DEMO_SECRET, data, "base64rawurl")}`;
};
