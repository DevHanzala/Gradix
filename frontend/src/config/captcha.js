let recaptchaLoaded = false;

// src/config/captcha.js
export const loadRecaptcha = (siteKey) => {
  return new Promise((resolve) => {
    if (window.recaptchaLoaded) return resolve();

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.onload = () => {
      window.recaptchaLoaded = true;

      // HIDE BADGE AFTER LOAD
      const badge = document.querySelector('.grecaptcha-badge');
      if (badge) badge.style.visibility = 'hidden';

      resolve();
    };
    document.head.appendChild(script);
  });
};

export const getCaptchaToken = (siteKey, action) => {
  return new Promise((resolve, reject) => {
    if (!window.grecaptcha) {
      return reject(new Error("reCAPTCHA not loaded"));
    }

    window.grecaptcha.ready(() => {
      window.grecaptcha
        .execute(siteKey, { action })
        .then((token) => resolve(token))
        .catch(reject);
    });
  });
};