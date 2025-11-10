import axios from "axios";

const verifyCaptcha = async (req, res, next) => {
  const { captchaToken } = req.body;

  if (!captchaToken) {
    return res.status(400).json({
      success: false,
      message: "CAPTCHA token is required",
    });
  }

  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    const response = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify", // ← v3 endpoint
      null,
      {
        params: {
          secret: secretKey,
          response: captchaToken,
          // v3: No 'remoteip' needed
        },
      }
    );

    const { success, score } = response.data;

    if (!success || (score && score < 0.5)) {
      console.log("CAPTCHA failed:", { success, score });
      return res.status(403).json({
        success: false,
        message: "Bot detected. Access denied.",
      });
    }

    console.log("CAPTCHA passed:", { success, score });
    next();
  } catch (error) {
    console.error("reCAPTCHA verification failed:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "CAPTCHA verification failed",
    });
  }
};

export default verifyCaptcha;