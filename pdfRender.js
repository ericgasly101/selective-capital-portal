// Renders an HTML string to a PDF Buffer using Puppeteer (headless Chrome).
// One browser instance is reused across requests — first call is slow
// (Chromium boot ~1-2s), subsequent calls are fast.
//
// On Railway, Chromium is provided by nixpacks.toml and the path is exposed
// via PUPPETEER_EXECUTABLE_PATH. Locally, puppeteer downloads its own copy
// at install time unless PUPPETEER_SKIP_DOWNLOAD is set.

const puppeteer = require('puppeteer');

let browserPromise = null;

function getBrowser() {
  if (browserPromise) return browserPromise;

  const launchOpts = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
    ],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  browserPromise = puppeteer.launch(launchOpts).catch(err => {
    browserPromise = null;
    throw err;
  });
  return browserPromise;
}

async function htmlToPdf(html, opts = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
    const pdf = await page.pdf({
      format: opts.format || 'A4',
      printBackground: true,
      margin: opts.margin || { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' },
      preferCSSPageSize: true,
    });
    return pdf;
  } finally {
    await page.close().catch(() => {});
  }
}

async function shutdown() {
  if (!browserPromise) return;
  try {
    const b = await browserPromise;
    await b.close();
  } catch (_) {}
  browserPromise = null;
}

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

module.exports = { htmlToPdf, shutdown };
