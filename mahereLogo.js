// Returns an HTML <img> or inline <svg> for the Mahere Capital logo,
// suitable for embedding in the formal application PDF header.
//
// Resolution order:
//   1. If public/mahere-logo.png exists, base64-embed it as a data URL
//      (so it travels with the PDF — no remote fetch).
//   2. If public/mahere-logo.svg exists, inline its SVG markup.
//   3. Otherwise fall back to a hand-drawn SVG approximation of the M-mark.

const fs = require('fs');
const path = require('path');

let cache = null;

function loadLogo() {
  if (cache !== null) return cache;
  const dir = __dirname;

  // Prefer PNG (the user's actual brand asset)
  try {
    const pngPath = path.join(dir, 'mahere-logo.png');
    if (fs.existsSync(pngPath)) {
      const buf = fs.readFileSync(pngPath);
      cache = '<img src="data:image/png;base64,' + buf.toString('base64') + '" alt="Mahere Capital" style="height:48px;width:auto;display:block" />';
      return cache;
    }
    const jpgPath = path.join(dir, 'mahere-logo.jpg');
    if (fs.existsSync(jpgPath)) {
      const buf = fs.readFileSync(jpgPath);
      cache = '<img src="data:image/jpeg;base64,' + buf.toString('base64') + '" alt="Mahere Capital" style="height:48px;width:auto;display:block" />';
      return cache;
    }
    const svgPath = path.join(dir, 'mahere-logo.svg');
    if (fs.existsSync(svgPath)) {
      cache = fs.readFileSync(svgPath, 'utf8');
      return cache;
    }
  } catch (err) {
    console.warn('[mahereLogo] failed to read logo asset, using fallback SVG:', err.message);
  }

  // Fallback SVG: stylized geometric "M" mark + "Mahere Capital" wordmark.
  // Two-tone blue M with a folded inner highlight, matching the real brand.
  cache =
    '<svg width="220" height="60" viewBox="0 0 320 86" xmlns="http://www.w3.org/2000/svg" aria-label="Mahere Capital">' +
      // Outer dark blue M shape
      '<path fill="#1d4ed8" d="M2 4 L26 4 L40 28 L40 78 C40 80 38 82 36 82 L6 82 C4 82 2 80 2 78 Z" />' +
      // Lighter blue M (right pillar)
      '<path fill="#2563eb" d="M40 4 L60 4 L60 82 L40 82 Z" />' +
      // White cutout creating the inner M valley
      '<path fill="#ffffff" d="M14 32 L14 70 L30 70 L30 50 L40 50 L40 70 L40 32 Z" />' +
      // Wordmark
      '<text x="78" y="38" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#0f1e44" letter-spacing="0.5">Mahere</text>' +
      '<text x="78" y="68" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#0f1e44" letter-spacing="0.5">Capital</text>' +
    '</svg>';
  return cache;
}

function clearCache() { cache = null; } // for tests

module.exports = { loadLogo, clearCache };
