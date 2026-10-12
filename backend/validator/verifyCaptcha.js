import axios from "axios";

const MIN_SCORE = 0.5;

/**
 * Indirection so tests can stub Google's verification endpoint.
 * Resolves to Google's siteverify response body.
 */
export const captchaVerifier = {
  verify: async (token) => {
    const response = await axios.post("https://www.google.com/recaptcha/api/siteverify", null, {
      params: { secret: process.env.RECAPTCHA_SECRET_KEY, response: token },
      timeout: 10000,
    });
    return response.data;
  },
};

// Middleware: verify a Google reCAPTCHA v3 token sent as `captchaToken`.
const verifyCaptcha = async (req, res, next) => {
  const captchaToken = req.body?.captchaToken;

  if (!captchaToken) {
    return res.status(400).json({ success: false, code: "CAPTCHA_REQUIRED", message: "CAPTCHA token is required" });
  }

  try {
    const { success, score } = await captchaVerifier.verify(captchaToken);
    if (!success || (typeof score === "number" && score < MIN_SCORE)) {
      return res.status(403).json({ success: false, code: "CAPTCHA_FAILED", message: "CAPTCHA check failed. Please try again." });
    }
    return next();
  } catch (error) {
    console.error("reCAPTCHA verification failed:", error.message);
    return res.status(503).json({ success: false, code: "CAPTCHA_UNAVAILABLE", message: "CAPTCHA verification is unavailable. Please try again." });
  }
};

export default verifyCaptcha;
