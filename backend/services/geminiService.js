import { GoogleGenAI } from "@google/genai";

let creationClient = null;
let checkingClient = null;

export const getCreationModel = async () => {
  const creationKey = process.env.GEMINI_CREATION_API_KEY;
  if (!creationClient) {
    if (!creationKey) {
      console.log("Debug: creationKey is", creationKey);
      console.log("Debug: Full process.env:", process.env);
      throw new Error("Missing GEMINI_CREATION_API_KEY");
    }
    creationClient = new GoogleGenAI({ apiKey: creationKey });
    console.log(`Initializing creation client with key present`);
  }
  try {
    console.log(`Client initialized, ready for generateContent`);
    return creationClient;
  } catch (error) {
    console.error(`❌ Failed to initialize creation client: ${error.message}`);
    throw error;
  }
};

export const getCheckingModel = async () => {
  const checkingKey = process.env.GEMINI_CHECKING_API_KEY;
  if (!checkingClient) {
    if (!checkingKey) {
      console.log("Debug: checkingKey is", checkingKey);
      console.log("Debug: Full process.env:", process.env);
      throw new Error("Missing GEMINI_CHECKING_API_KEY");
    }
    checkingClient = new GoogleGenAI({ apiKey: checkingKey });
    console.log(`Initializing checking client with key present`);
  }
  try {
    console.log(`Client initialized, ready for generateContent`);
    return checkingClient;
  } catch (error) {
    console.error(`❌ Failed to initialize checking client: ${error.message}`);
    throw error;
  }
};

// Utility to map UI language codes to Gemini prompt hints
export const mapLanguageCode = (lang) => {
  const map = {
    en: "English",
    ur: "Urdu",
    ar: "Arabic",
    fa: "Persian",
  };
  return map[lang] || "English";
};

// Helper function to generate content
export const generateContent = async (client, prompt, options = {}) => {
  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash", // Explicitly set to your working model
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        generationConfig: {
          maxOutputTokens: options.maxOutputTokens || 4000,
          temperature: options.temperature || 0.7,
          ...options.generationConfig,
        },
        thinkingConfig: options.thinkingConfig || { thinkingBudget: 0 }, // Default to disable thinking
        ...options,
      },
    });
    console.log(`Debug: Full response object:`, response); // Log to inspect structure
    // Enhanced response handling to prevent undefined/null errors
    const text = response.text || 
                 (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) || 
                 (response.candidates && response.candidates[0]?.output) || 
                 "No text available";
    console.log(`✅ Generated content: ${text.substring(0, 100)}${text.length > 100 ? "..." : ""}`);
    if (!text || text === "No text available") {
      throw new Error("No valid text content in response");
    }
    return text;
  } catch (error) {
    console.error(`❌ Failed to generate content: ${error.message}`);
    if (error.message.includes("RESOURCE_EXHAUSTED")) {
      console.log("🔄 Quota exceeded, retrying in 60 seconds...");
      await new Promise(resolve => setTimeout(resolve, 60000));
      return generateContent(client, prompt, options); // Retry
    }
    if (error.message.includes("NOT_FOUND") || error.message.includes("INVALID_ARGUMENT")) {
      console.log("🔄 Switching to fallback model: gemini-2.5-pro"); // Updated fallback
      const fallbackClient = new GoogleGenAI({ apiKey: process.env.GEMINI_CREATION_API_KEY });
      return generateContent(fallbackClient, prompt, { model: "gemini-2.5-pro", ...options });
    }
    throw error;
  }
};