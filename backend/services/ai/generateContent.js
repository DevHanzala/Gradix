import { getRandomCreationProvider } from "./aiProviders.js";

/* =========================
   GENERATE CONTENT (CONTROLLED)
========================= */

export const generateContent = async (prompt, options = {}) => {
  const primary = getRandomCreationProvider();
  const secondary = getRandomCreationProvider();

  const attempt = async (provider) => {
    if (provider.type === "gemini") {
      const response = await provider.client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: options.maxOutputTokens || 3000,
          temperature: options.temperature ?? 0.7,
          topP: options.topP ?? 0.9,
        },
        thinkingConfig: { thinkingBudget: 0 },
      });

      const text =
        response.text ||
        response?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) throw new Error("Empty Gemini response");
      return { text, provider: "gemini" };
    }

    if (provider.type === "groq") {
      const response = await provider.client.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: [{ role: "user", content: prompt }],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxOutputTokens || 3000,
      });

      const text = response?.choices?.[0]?.message?.content;
      if (!text) throw new Error("Empty Groq response");

      return { text, provider: "groq" };
    }

    throw new Error("Unknown provider");
  };

  /* =========================
     PRIMARY ATTEMPT
  ========================= */

  try {
    const result = await attempt(primary);
    console.log(`✅ AI used: ${result.provider}`);
    return result.text;
  } catch (primaryError) {
    console.warn(
      `⚠️ Primary AI failed (${primary.type}):`,
      primaryError.message
    );
  }

  /* =========================
     SINGLE FALLBACK ATTEMPT
  ========================= */

  try {
    const result = await attempt(secondary);
    console.log(`✅ Fallback AI used: ${result.provider}`);
    return result.text;
  } catch (secondaryError) {
    console.error("❌ Both AI providers failed");
    throw secondaryError;
  }
};
