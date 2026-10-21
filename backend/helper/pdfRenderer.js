import puppeteer from "puppeteer";

/**
 * Render a self-contained HTML document to an A4 PDF with headless Chromium.
 * The HTML must embed its fonts (helper/pdfFonts.js); no network is used.
 */
export const pdfRenderer = {
  render: async (html, { format = "A4" } = {}) => {
    const browser = await puppeteer.launch({
      headless: "new",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--font-render-hinting=medium"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      await page.evaluateHandle("document.fonts.ready");
      return Buffer.from(await page.pdf({ format, printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" } }));
    } finally {
      await browser.close();
    }
  },
};
