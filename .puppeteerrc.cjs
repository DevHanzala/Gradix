const { join } = require("path");

/**
 * On Render, Puppeteer's default Chrome cache (~/.cache) is not kept from the
 * build to the running service, so PDFs fail with "Could not find Chrome".
 * Keep Chrome inside the project folder there (Render sets RENDER=true during
 * build and runtime). Locally nothing changes.
 */
module.exports = process.env.RENDER ? { cacheDirectory: join(__dirname, ".cache", "puppeteer") } : {};
