import { Redis } from "@upstash/redis";
import { requireEnv } from "../config/env.js";

let client = null;

/**
 * Lazily create the Upstash client. Credentials come only from the
 * environment; a missing variable is a hard error, never a silent fallback.
 */
export const getRedis = () => {
  if (!client) {
    client = new Redis({
      url: requireEnv("UPSTASH_REDIS_REST_URL"),
      token: requireEnv("UPSTASH_REDIS_REST_TOKEN"),
    });
  }
  return client;
};
