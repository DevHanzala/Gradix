import { GoogleGenAI } from "@google/genai";

/* =========================
   CREATION KEYS (MULTI-PROJECT)
========================= */

const CREATION_KEYS = [
  process.env.GEMINI_CREATION_API_KEY_1,
  process.env.GEMINI_CREATION_API_KEY_2,
].filter(Boolean);

if (CREATION_KEYS.length === 0) {
  throw new Error("❌ No GEMINI_CREATION_API_KEYs found in .env");
}

let creationClients = [];
let activeCreationIndex = 0;

/* =========================
   CHECKING KEY (SINGLE)
========================= */

let checkingClient = null;

/* =========================
   INITIALIZE CREATION CLIENTS
========================= */

function initCreationClients() {
  if (creationClients.length === 0) {
    creationClients = CREATION_KEYS.map(
      (key) => new GoogleGenAI({ apiKey: key })
    );
    console.log(`✅ Initialized ${creationClients.length} Gemini creation clients`);
  }
}

/* =========================
   GET ACTIVE CREATION CLIENT
========================= */

export const getCreationModel = async () => {
  initCreationClients();
  return creationClients[activeCreationIndex];
};

/* =========================
   ROTATE KEY ON QUOTA EXCEEDED
========================= */

function rotateCreationKey() {
  activeCreationIndex = (activeCreationIndex + 1) % creationClients.length;
  console.warn(`🔄 Switched Gemini creation key → index ${activeCreationIndex}`);
}

/* =========================
   CHECKING MODEL
========================= */

export const getCheckingModel = async () => {
  if (!checkingClient) {
    const key = process.env.GEMINI_CHECKING_API_KEY;
    if (!key) throw new Error("❌ Missing GEMINI_CHECKING_API_KEY");
    checkingClient = new GoogleGenAI({ apiKey: key });
    console.log("✅ Initialized Gemini checking client");
  }
  return checkingClient;
};

/* =========================
   LANGUAGE MAP
========================= */

export const mapLanguageCode = (lang) => {
  const map = {
    en: "English",
    ur: "Urdu",
    ar: "Arabic",
    fa: "Persian",
  };
  return map[lang] || "English";
};

/* =========================
   SAFE CONTENT GENERATOR
========================= */

export const generateContent = async (client, prompt, options = {}) => {
  try {
    const response = await client.models.generateContent({
      model: options.model || "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: options.maxOutputTokens || 1200,
        temperature: options.temperature ?? 0.7,
        topP: options.topP ?? 0.9,
      },
      thinkingConfig: options.thinkingConfig || { thinkingBudget: 0 },
    });

    const text =
      response.text ||
      response?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error("Empty Gemini response");

    return text;
  } catch (error) {
    /* === QUOTA HANDLING === */
    if (
      error.message.includes("RESOURCE_EXHAUSTED") ||
      error.message.includes("429")
    ) {
      console.warn("⚠️ Gemini quota exceeded, rotating key...");
      rotateCreationKey();

      const fallbackClient = await getCreationModel();
      return generateContent(fallbackClient, prompt, options);
    }

    throw error;
  }
};
