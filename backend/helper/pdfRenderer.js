/**
 * Render a self-contained HTML document to a PDF with headless Chromium.
 * The HTML must embed its fonts (helper/pdfFonts.js); no network is used.
 *
 * Memory (Render free tier, 512 MB): Puppeteer is loaded only when the first PDF is
 * needed, Chromium starts for each PDF and is closed right after, with low-memory
 * flags, and PDFs render ONE AT A TIME through a queue (a second request waits).
 */
const LOW_MEMORY_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-zygote",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-default-apps",
  "--disable-sync",
  "--mute-audio",
  "--no-first-run",
  "--renderer-process-limit=1",
  "--js-flags=--max-old-space-size=128",
  "--font-render-hinting=medium",
];

let queue = Promise.resolve();
let waiting = 0;
export const pdfQueueLength = () => waiting;

const renderNow = async (html, { format = "A4" } = {}) => {
  const { default: puppeteer } = await import("puppeteer");
  const browser = await puppeteer.launch({
    headless: "shell", // chrome-headless-shell: the light headless build, far less memory than full Chrome
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: LOW_MEMORY_ARGS,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluateHandle("document.fonts.ready");
    return Buffer.from(await page.pdf({ format, printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" } }));
  } finally {
    await browser.close();
  }
};

export const pdfRenderer = {
  render: (html, options) => {
    waiting += 1;
    const job = queue.then(() => renderNow(html, options));
    queue = job.catch(() => {}).finally(() => {
      waiting -= 1;
    });
    return job;
  },
};
