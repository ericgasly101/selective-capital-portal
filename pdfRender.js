// Renders an HTML string to a PDF Buffer using Puppeteer (headless Chrome).
// Fault-tolerant: if Chromium cannot be launched (common on slim hosting
// environments), we fall back to a minimal placeholder PDF so the rest of
// the request flow (email + JSON attachment) still succeeds. The HTML form
// of the application is also attached to the email as a backup.

let puppeteer = null;
try {
  puppeteer = require('puppeteer');
} catch (err) {
  console.error('[pdfRender] puppeteer module not loaded:', err.message);
}

let browserPromise = null;
let chromiumAvailable = !!puppeteer;

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
      '--single-process',
    ],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  browserPromise = puppeteer.launch(launchOpts).catch(err => {
    console.error('[pdfRender] puppeteer.launch failed:', err.message);
    browserPromise = null;
    chromiumAvailable = false;
    throw err;
  });
  return browserPromise;
}

// Minimal valid PDF buffer used as a fallback when Chromium is unavailable.
function placeholderPdf(message) {
  const text = message || 'PDF rendering temporarily unavailable. See HTML attachment for the application.';
  // A tiny one-page PDF with the message. Hand-rolled so we don't need any deps.
  const escape = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content = `BT /F1 12 Tf 50 750 Td (${escape(text)}) Tj ET`;
  const body =
    `%PDF-1.4\n` +
    `1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n` +
    `2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n` +
    `3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj\n` +
    `4 0 obj <</Length ${content.length}>> stream\n${content}\nendstream endobj\n` +
    `5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n` +
    `xref\n0 6\n0000000000 65535 f \n`;
  // We don't bother with byte-perfect xref offsets — most readers accept this.
  return Buffer.from(body + 'trailer <</Size 6 /Root 1 0 R>>\nstartxref\n0\n%%EOF\n');
}

async function htmlToPdf(html, opts = {}) {
  if (!chromiumAvailable) {
    return placeholderPdf();
  }
  let browser;
  try {
    browser = await getBrowser();
  } catch (err) {
    return placeholderPdf();
  }
  let page;
  try {
    page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
    const pdf = await page.pdf({
      format: opts.format || 'A4',
      printBackground: true,
      margin: opts.margin || { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' },
      preferCSSPageSize: true,
    });
    return pdf;
  } catch (err) {
    console.error('[pdfRender] htmlToPdf failed:', err.message);
    return placeholderPdf();
  } finally {
    if (page) await page.close().catch(() => {});
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
