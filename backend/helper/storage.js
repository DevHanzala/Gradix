import { createHmac, timingSafeEqual } from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { AppError } from "../utils/AppError.js";

/**
 * File storage, chosen by STORAGE_DRIVER:
 *  - local: a folder on this machine (development). STORAGE_LOCAL_DIR, default backend/storage.
 *  - r2:    Cloudflare R2 (S3-compatible) for production, because Render's disk is wiped on
 *           every deploy and restart. R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *           R2_BUCKET (R2_ENDPOINT overrides the endpoint, e.g. a local S3 emulator).
 *
 * Files are private. They are handed out only as short-lived signed URLs, after the
 * caller has checked that the user may see the file:
 *  - r2:    a presigned GET URL straight to R2;
 *  - local: /api/files/<key>?e=<expiry>&s=<signature>, verified by routes/fileRoutes.js.
 *
 * Keys look like "resources/12/notes.pdf" (letters, digits, - _ . / only; no "..").
 */
export const SIGNED_URL_TTL_SECONDS = 300;
const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const setting = (name, env = process.env) => (env[name] && String(env[name]).trim()) || "";
export const storageDriverName = (env = process.env) => (setting("STORAGE_DRIVER", env) || "local").toLowerCase();

/** Variables the chosen driver needs (startup check). */
export const missingStorageSettings = (env = process.env) => {
  const driver = storageDriverName(env);
  if (driver === "local") return [];
  if (driver !== "r2") return ["STORAGE_DRIVER must be local or r2"];
  const needed = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];
  if (!setting("R2_ENDPOINT", env)) needed.unshift("R2_ACCOUNT_ID");
  return needed.filter((name) => !setting(name, env));
};

export const assertKey = (key) => {
  const k = String(key || "");
  if (!/^[\w.\-/]+$/.test(k) || k.includes("..") || k.startsWith("/") || k.length > 500) {
    throw new AppError("INVALID_FILE_KEY", 400, "Invalid file reference.");
  }
  return k;
};

/** A filename safe inside a key: ASCII letters/digits/-_. only, keeping the extension ("نوٹس.pdf" -> "file.pdf"). */
export const safeFileName = (name, fallback = "file") => {
  const full = String(name || "");
  const ext = (full.match(/\.[A-Za-z0-9]{1,8}$/) || [""])[0].toLowerCase();
  const stem = full
    .slice(0, full.length - ext.length)
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 70);
  return `${stem || fallback}${ext}`;
};

/** Content-Disposition that keeps Urdu/Arabic names (RFC 5987) with an ASCII fallback. */
export const contentDisposition = (filename, disposition = "attachment") => {
  const name = String(filename || "download");
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
};

// ------------------------------------------------------------------ local

const signingSecret = () => setting("STORAGE_SIGNING_SECRET") || setting("JWT_SECRET");

const signature = (key, expires, filename, contentType) =>
  createHmac("sha256", signingSecret()).update([key, expires, filename, contentType].join("\n")).digest("base64url");

/** Check a local signed URL's parameters; returns { key, filename, contentType } or throws 403. */
export const verifyLocalSignature = ({ key, e, n = "", t = "", s = "" }) => {
  const expires = Number(e);
  const expected = signature(key, expires, n, t);
  const valid =
    Number.isFinite(expires) &&
    expires * 1000 > Date.now() &&
    s.length === expected.length &&
    timingSafeEqual(Buffer.from(s), Buffer.from(expected));
  if (!valid) throw new AppError("LINK_EXPIRED", 403, "This download link has expired or is invalid.");
  return { key: assertKey(key), filename: n, contentType: t };
};

const localRoot = () => path.resolve(setting("STORAGE_LOCAL_DIR") || path.join(BACKEND_DIR, "storage"));
const localPath = (key) => path.join(localRoot(), ...assertKey(key).split("/"));

const notFound = () => new AppError("FILE_NOT_FOUND", 404, "The file was not found.");

export const localDriver = {
  name: "local",
  put: async (key, body) => {
    const file = localPath(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
  },
  get: async (key) => {
    try {
      return await fs.readFile(localPath(key));
    } catch (error) {
      if (error.code === "ENOENT") throw notFound();
      throw error;
    }
  },
  delete: async (key) => fs.rm(localPath(key), { force: true }),
  list: async (prefix = "") => {
    const root = localRoot();
    const out = [];
    const walk = async (dir) => {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else out.push(path.relative(root, full).split(path.sep).join("/"));
      }
    };
    await walk(root);
    return out.filter((k) => k.startsWith(prefix)).sort();
  },
  signedUrl: async (key, { expiresIn, filename = "", contentType = "", baseUrl = "" }) => {
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const params = new URLSearchParams({ e: String(expires), n: filename, t: contentType, s: signature(key, expires, filename, contentType) });
    return `${baseUrl}/api/files/${assertKey(key).split("/").map(encodeURIComponent).join("/")}?${params}`;
  },
  check: async () => {
    await fs.mkdir(localRoot(), { recursive: true });
    await fs.access(localRoot());
  },
};

// --------------------------------------------------------------------- r2

let s3 = null;
const s3Client = async () => {
  if (!s3) {
    // Loaded only when R2 is used.
    const sdk = await import("@aws-sdk/client-s3");
    s3 = {
      sdk,
      client: new sdk.S3Client({
        region: "auto",
        endpoint: setting("R2_ENDPOINT") || `https://${setting("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
        forcePathStyle: true,
        credentials: { accessKeyId: setting("R2_ACCESS_KEY_ID"), secretAccessKey: setting("R2_SECRET_ACCESS_KEY") },
      }),
    };
  }
  return s3;
};
const bucket = () => setting("R2_BUCKET");

export const r2Driver = {
  name: "r2",
  put: async (key, body, { contentType } = {}) => {
    const { sdk, client } = await s3Client();
    await client.send(new sdk.PutObjectCommand({ Bucket: bucket(), Key: assertKey(key), Body: body, ContentType: contentType || "application/octet-stream" }));
  },
  get: async (key) => {
    const { sdk, client } = await s3Client();
    try {
      const res = await client.send(new sdk.GetObjectCommand({ Bucket: bucket(), Key: assertKey(key) }));
      return Buffer.from(await res.Body.transformToByteArray());
    } catch (error) {
      if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) throw notFound();
      throw error;
    }
  },
  delete: async (key) => {
    const { sdk, client } = await s3Client();
    await client.send(new sdk.DeleteObjectCommand({ Bucket: bucket(), Key: assertKey(key) }));
  },
  list: async (prefix = "") => {
    const { sdk, client } = await s3Client();
    const keys = [];
    let token;
    do {
      const res = await client.send(new sdk.ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }));
      for (const item of res.Contents || []) keys.push(item.Key);
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return keys.sort();
  },
  signedUrl: async (key, { expiresIn, filename, contentType }) => {
    const { sdk, client } = await s3Client();
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const command = new sdk.GetObjectCommand({
      Bucket: bucket(),
      Key: assertKey(key),
      ...(filename ? { ResponseContentDisposition: contentDisposition(filename) } : {}),
      ...(contentType ? { ResponseContentType: contentType } : {}),
    });
    return getSignedUrl(client, command, { expiresIn });
  },
  check: async () => {
    const { sdk, client } = await s3Client();
    await client.send(new sdk.HeadBucketCommand({ Bucket: bucket() }));
  },
};

const DRIVERS = { local: localDriver, r2: r2Driver };

/** Tests can pin a driver here; otherwise STORAGE_DRIVER decides on every call. */
export const storageAdapter = { driver: null };
const driver = () => storageAdapter.driver || DRIVERS[storageDriverName()] || localDriver;

export const storage = {
  get driverName() {
    return driver().name;
  },
  put: (key, body, options) => driver().put(assertKey(key), body, options),
  get: (key) => driver().get(key),
  delete: (key) => driver().delete(key),
  list: (prefix) => driver().list(prefix),
  check: () => driver().check(),
  /**
   * Short-lived URL for a file. Call only after checking the user may see it.
   * baseUrl (the API's public origin) is needed by the local driver.
   */
  signedUrl: async (key, { filename = "", contentType = "", baseUrl = "", expiresIn = SIGNED_URL_TTL_SECONDS } = {}) => ({
    url: await driver().signedUrl(assertKey(key), { expiresIn, filename, contentType, baseUrl }),
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  }),
};

/** The API's public origin for this request (behind Render's proxy with TRUST_PROXY=1). */
export const publicBaseUrl = (req) => `${req.protocol}://${req.get("host")}`;

export { DRIVERS as STORAGE_DRIVERS };
