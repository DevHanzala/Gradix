import dns from "dns/promises";
import net from "net";
import { AppError } from "../utils/AppError.js";
import { cleanText } from "./textProcessor.js";
import { assessTextQuality } from "./textQuality.js";

/**
 * Read web pages and YouTube transcripts as source material.
 *
 * Safety (the server fetches URLs an instructor typed):
 *  - only http/https on the default ports;
 *  - every hop's host must resolve to a public address (no localhost,
 *    private, link-local or metadata ranges) — checked again on redirects;
 *  - at most 3 redirects, 10 s, 3 MB, text/html or text/plain only.
 * Page text is extracted with Mozilla Readability (the article, not menus).
 */
const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;

const unreadable = (message) => new AppError("UNREADABLE_LINK", 422, message);

const PRIVATE_V4 = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];
const v4ToInt = (ip) => ip.split(".").reduce((n, part) => (n << 8) + Number(part), 0) >>> 0;

export const isPrivateAddress = (ip) => {
  if (net.isIPv4(ip)) {
    const value = v4ToInt(ip);
    return PRIVATE_V4.some(([base, bits]) => (value & (~0 << (32 - bits))) >>> 0 === (v4ToInt(base) & (~0 << (32 - bits))) >>> 0);
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb)/.test(lower);
};

export const assertPublicUrl = async (raw) => {
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    throw new AppError("INVALID_URL", 400, "Please enter a valid link.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new AppError("INVALID_URL", 400, "Links must start with http:// or https://.");
  if (url.port && !["80", "443"].includes(url.port)) throw new AppError("INVALID_URL", 400, "Links on non-standard ports are not allowed.");
  if (url.username || url.password) throw new AppError("INVALID_URL", 400, "Links with credentials are not allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (!addresses.length) throw unreadable(`${url.hostname} could not be reached.`);
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new AppError("INVALID_URL", 400, "This address is not allowed.");
  return url;
};

/** Network access behind an adapter so tests never touch the internet. */
export const linkFetcher = {
  fetch: async (startUrl, { accept = "text/html,text/plain" } = {}) => {
    let url = await assertPublicUrl(startUrl);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept, "user-agent": "GradixBot/1.0 (+source material reader)" },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        url = await assertPublicUrl(new URL(response.headers.get("location") || "", url).toString());
        continue;
      }
      if (!response.ok) throw unreadable(`The page returned an error (${response.status}).`);
      const type = response.headers.get("content-type") || "";
      if (!/text\/html|text\/plain|application\/xml|text\/xml|application\/json/.test(type)) {
        throw unreadable("This link is not a web page. Upload the file instead.");
      }
      const length = Number(response.headers.get("content-length") || 0);
      if (length > MAX_BYTES) throw unreadable("The page is too large to read.");
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > MAX_BYTES) throw unreadable("The page is too large to read.");
      return { body: buffer.toString("utf8"), contentType: type, finalUrl: url.toString() };
    }
    throw unreadable("The link redirects too many times.");
  },
};

// ------------------------------------------------------------- YouTube

export const youtubeId = (raw) => {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (url.searchParams.get("v")) return url.searchParams.get("v");
      const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/);
      return match ? match[1] : null;
    }
  } catch {
    return null;
  }
  return null;
};

const decodeEntities = (s) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/** Transcript of a YouTube video (captions; manual tracks preferred over auto). */
const youtubeTranscript = async (videoId, preferredLanguage) => {
  const page = await linkFetcher.fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`);
  const match = page.body.match(/"captionTracks":(\[.*?\])/);
  if (!match) throw unreadable("This video has no captions or transcript to read.");
  let tracks;
  try {
    tracks = JSON.parse(match[1]);
  } catch {
    throw unreadable("The video's transcript could not be read.");
  }
  const pick =
    tracks.find((t) => t.languageCode === preferredLanguage && t.kind !== "asr") ||
    tracks.find((t) => t.kind !== "asr") ||
    tracks.find((t) => t.languageCode === preferredLanguage) ||
    tracks[0];
  const title = (page.body.match(/<title>(.*?)<\/title>/) || [])[1]?.replace(/ - YouTube$/, "");
  const xml = await linkFetcher.fetch(pick.baseUrl.replace(/\\u0026/g, "&"), { accept: "text/xml,application/xml" });
  const text = [...xml.body.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) => decodeEntities(decodeEntities(m[1]))).join(" ");
  return { title: title ? decodeEntities(title) : `YouTube ${videoId}`, text, method: "youtube" };
};

// --------------------------------------------------------------- pages

const readablePage = async (url) => {
  const page = await linkFetcher.fetch(url);
  if (!/html/.test(page.contentType)) return { title: new URL(page.finalUrl).hostname, text: page.body, method: "link" };
  const [{ JSDOM }, { Readability }] = await Promise.all([import("jsdom"), import("@mozilla/readability")]);
  const dom = new JSDOM(page.body, { url: page.finalUrl });
  const article = new Readability(dom.window.document).parse();
  const text = article?.textContent || dom.window.document.body?.textContent || "";
  return { title: article?.title || dom.window.document.title || new URL(page.finalUrl).hostname, text, method: "link" };
};

/**
 * Text of a link (web page or YouTube video). Throws AppError (400/422) with
 * a message an instructor can act on.
 */
export const extractLinkText = async (url, { language = "en" } = {}) => {
  const id = youtubeId(url);
  const result = id ? await youtubeTranscript(id, language) : await readablePage(url);
  const text = cleanText(result.text);
  if (!assessTextQuality(text).ok) throw unreadable("No readable text was found at this link.");
  return { ...result, text };
};
