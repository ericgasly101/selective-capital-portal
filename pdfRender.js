// Renders HTML to PDF using puppeteer-core + @sparticuz/chromium
// (a slim, container-friendly Chrome that works on Railway).

const puppeteer = require('puppeteer-core');
const chromium  = require('@sparticuz/chromium');

let browserPromise = null;

function getBrowser() {
  if (browserPromise) return browserPromise;
  browserPromise = (async () => {
    const executablePath = await chromium.executablePath();
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
  })().catch(err => { browserPromise = null; throw err; });
  return browserPromise;
}

async function htmlToPdf(html, opts = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
    return await page.pdf({
      format: opts.format || 'A4',
      printBackground: true,
      margin: opts.margin || { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' },
      preferCSSPageSize: true,
    });
  } finally {
    await page.close().catch(() => {});
  }
}

async function shutdown() {
  if (!browserPromise) return;
  try { (await browserPromise).close(); } catch (_) {}
  browserPromise = null;
}

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

module.exports = { htmlToPdf, shutdown };
