import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

/* =========================
   GEMINI CREATION PROVIDERS
========================= */

const geminiKeys = [
  process.env.GEMINI_CREATION_API_KEY_1,
  process.env.GEMINI_CREATION_API_KEY_2,
].filter(Boolean);

const geminiClients = geminiKeys.map(
  (key) => new GoogleGenAI({ apiKey: key })
);

/* =========================
   GROQ PROVIDER
========================= */

const groqClient = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

/* =========================
   CHECKING MODEL (SINGLE)
========================= */

let checkingClient = null;

export const getCheckingModel = async () => {
  if (!checkingClient) {
    if (!process.env.GEMINI_CHECKING_API_KEY) {
      throw new Error("❌ Missing GEMINI_CHECKING_API_KEY");
    }

    checkingClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_CHECKING_API_KEY,
    });

    console.log("✅ Gemini checking model initialized");
  }

  return checkingClient;
};

/* =========================
   RANDOM CREATION PROVIDER
========================= */

export const getRandomCreationProvider = () => {
  const providers = [];

  if (geminiClients.length > 0) {
    providers.push({
      type: "gemini",
      client: geminiClients[Math.floor(Math.random() * geminiClients.length)],
    });
  }

  if (groqClient) {
    providers.push({
      type: "groq",
      client: groqClient,
    });
  }

  if (providers.length === 0) {
    throw new Error("❌ No AI providers available");
  }

  return providers[Math.floor(Math.random() * providers.length)];
};
