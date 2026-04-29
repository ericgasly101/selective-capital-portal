// Renders the formal Mahere Capital "Funding Application" PDF directly with
// PDFKit — pure Node, no Chromium dependency. The layout intentionally mirrors
// the Aegis/Mahere visual style: dark-blue accents, numbered sections, fielded
// rows with ALL-CAPS labels and bold values, and a typed-italic signature.
//
// Public API:
//   renderApplicationPdf({ data, rep, reference, dateOnly, timeOnly }) -> Buffer
//
// Back-compat exports (htmlToPdf / shutdown) remain so existing callers still
// work; htmlToPdf is now a thin wrapper that ignores HTML and uses the data
// passed via opts (or returns a placeholder).

const PDFDocument = require('pdfkit');

const COLORS = {
  ink:        '#0f172a',
  muted:      '#64748b',
  accentDk:   '#1d4ed8',
  accentLt:   '#eff6ff',
  border:     '#e2e8f0',
  borderSoft: '#f1f5f9',
  navy:       '#0f1e44',
};

const PAGE = {
  size:    'A4',
  margin:  40,
};

function fmtMoney(v) {
  if (v == null || v === '') return '';
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  if (!isFinite(n)) return String(v);
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d)) return String(s);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Draw a horizontal "section header" bar with a numbered tile and a label.
function drawSectionHeader(doc, { num, title, x, y, width }) {
  const h = 24;
  // background pill
  doc.save();
  doc.roundedRect(x, y, width, h, 4).fill(COLORS.accentLt);
  doc.restore();

  // numbered square tile
  const tileW = 20, tileH = 16;
  const tileX = x + 8, tileY = y + (h - tileH) / 2;
  doc.save();
  doc.roundedRect(tileX, tileY, tileW, tileH, 3).fill(COLORS.accentDk);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10)
     .text(String(num).padStart(2, '0'), tileX, tileY + 3, { width: tileW, align: 'center' });
  doc.restore();

  // title
  doc.fillColor(COLORS.accentDk).font('Helvetica-Bold').fontSize(10)
     .text(title.toUpperCase(), tileX + tileW + 10, y + 7, { width: width - tileW - 24, characterSpacing: 1.2 });

  return y + h;
}

// One row that spans the section's width; cells are equal-width.
function drawFieldRow(doc, { x, y, width, cells }) {
  const colW = width / cells.length;
  const padX = 12, padY = 6;
  const labelH = 11, valueH = 13;
  const rowH = padY + labelH + 4 + valueH + padY;

  // borders
  doc.save();
  doc.lineWidth(0.5).strokeColor(COLORS.borderSoft);
  doc.moveTo(x, y + rowH).lineTo(x + width, y + rowH).stroke(); // bottom
  for (let i = 1; i < cells.length; i++) {
    const cx = x + i * colW;
    doc.moveTo(cx, y + 2).lineTo(cx, y + rowH - 2).stroke();
  }
  doc.restore();

  cells.forEach((c, i) => {
    const cx = x + i * colW + padX;
    doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7.5)
       .text(String(c.label || '').toUpperCase(), cx, y + padY, { width: colW - padX * 2, characterSpacing: 1.0 });
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(11)
       .text(c.value && String(c.value).trim() ? String(c.value) : '—', cx, y + padY + labelH + 4, { width: colW - padX * 2 });
  });
  return y + rowH;
}

function renderApplicationPdf({ data = {}, rep = {}, reference = '', dateOnly, timeOnly }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: PAGE.size, margin: PAGE.margin, autoFirstPage: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width  - PAGE.margin * 2;
    const X = PAGE.margin;
    let y = PAGE.margin;

    // ---------- Header ----------
    // Mahere logo (top-left). The PNG is bundled in the deploy folder.
    const markX = X, markY = y, markH = 36;
    const logoPath = require('path').join(__dirname, 'mahere-logo.png');
    try {
      doc.image(logoPath, markX, markY, { height: markH });
    } catch (e) {
      // Fallback to a simple text mark if the image is missing
      doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(16)
         .text('Mahere Capital', markX, markY + 8);
    }

    // Right-aligned reference block
    const refBlockW = 160;
    const refBlockX = X + W - refBlockW;
    doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7.5)
       .text('REFERENCE', refBlockX, markY, { width: refBlockW, align: 'right', characterSpacing: 1.2 });
    doc.fillColor(COLORS.accentDk).font('Helvetica-Bold').fontSize(12)
       .text('#' + reference, refBlockX, markY + 11, { width: refBlockW, align: 'right' });
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9)
       .text(dateOnly || '', refBlockX, markY + 26, { width: refBlockW, align: 'right' });

    y = markY + 50;

    // ---------- Title ----------
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(22)
       .text('Funding Application', X, y);
    y += 28;
    doc.save();
    doc.rect(X, y, W, 2).fill(COLORS.accentDk);
    doc.restore();
    y += 14;

    // ---------- Section 01: Business Information ----------
    y = drawSectionHeader(doc, { num: 1, title: 'Business Information', x: X, y, width: W });

    y = drawFieldRow(doc, {
      x: X, y, width: W,
      cells: [{ label: 'Legal Business Name', value: (data.businessName || '').toUpperCase() }],
    });
    y = drawFieldRow(doc, {
      x: X, y, width: W,
      cells: [
        { label: 'EIN #',               value: data.ein || '' },
        { label: 'Business Start Date', value: fmtDate(data.businessStartDate) },
      ],
    });
    y = drawFieldRow(doc, {
      x: X, y, width: W,
      cells: [{ label: 'Legal Entity Type', value: data.entityType || '' }],
    });
    const bizAddr = [data.businessAddress, data.businessCity, data.businessState, data.businessZip].filter(Boolean).join(' ').toUpperCase();
    y = drawFieldRow(doc, {
      x: X, y, width: W,
      cells: [{ label: 'Company Address', value: bizAddr }],
    });

    y += 10;

    // ---------- Section 02: Owner Information ----------
    y = drawSectionHeader(doc, { num: 2, title: 'Owner Information', x: X, y, width: W });

    const ownerName = [data.ownerFirstName, data.ownerLastName].filter(Boolean).join(' ');
    y = drawFieldRow(doc, {
      x: X, y, width: W,
      cells: [
        { label: 'Owner Full Name', value: ownerName },
        { label: 'Ownership %',     value: data.ownershipPct ? data.ownershipPct + (String(data.ownershipPct).includes('%') ? '' : '') : '' },
      ],
    });
    y = drawFieldRow(doc, {
      x: X, y, width: W,
      cells: [
        { label: 'SSN #',         value: data.ownerSsn || '' },
        { label: 'Date of Birth', value: fmtDate(data.ownerDob) },
      ],
    });
    const ownerAddr = [data.ownerAddress, data.ownerCity, data.ownerState, data.ownerZip].filter(Boolean).join(' ').toUpperCase();
    y = drawFieldRow(doc, {
      x: X, y, width: W,
      cells: [{ label: 'Home Address', value: ownerAddr }],
    });
    y = drawFieldRow(doc, {
      x: X, y, width: W,
      cells: [{ label: 'Second Owner (20%-49%)', value: data.secondOwner || 'None' }],
    });

    y += 18;

    // ---------- Authorization (no section header bar; flows directly into disclaimer) ----------

    // Disclaimer block
    const discText =
      'By signing below, I certify that I am authorized to apply for funding on behalf of the above ' +
      'Company and that all information provided is true, accurate, and complete. I authorize Mahere ' +
      'Capital and its funding partners to obtain business and personal credit reports in connection ' +
      'with this application. This application does not constitute a commitment to fund.';
    doc.save();
    doc.roundedRect(X, y, W, 50, 4).fill(COLORS.accentLt);
    doc.restore();
    // left bar
    doc.save();
    doc.rect(X, y, 4, 50).fill(COLORS.accentDk);
    doc.restore();
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9)
       .text(discText, X + 14, y + 7, { width: W - 28, lineGap: 1.5 });
    y += 60;

    // Signature & date row -- electronic signature emphasized
    const halfW = (W - 16) / 2;
    const sigBoxH = 70;

    // ----- Left: APPLICANT SIGNATURE -----
    doc.save();
    doc.roundedRect(X, y, halfW, sigBoxH, 4).fill('#fafbff');
    doc.restore();
    doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7.5)
       .text('APPLICANT SIGNATURE', X + 12, y + 8, { width: halfW - 24, characterSpacing: 1.2 });

    // Italic typed signature in Times for a more handwritten feel
    doc.fillColor(COLORS.ink).font('Times-BoldItalic').fontSize(24)
       .text(ownerName || data.businessName || '', X + 12, y + 22, { width: halfW - 24 });

    // Underline + printed name
    doc.save();
    doc.moveTo(X + 12, y + 56).lineTo(X + halfW - 12, y + 56)
       .strokeColor('#cbd5e1').lineWidth(0.7).stroke();
    doc.restore();
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9)
       .text(ownerName || '', X + 12, y + 60, { width: halfW - 24 });

    // ----- Right: DATE SIGNED + e-sign stamp -----
    const dateX = X + halfW + 16;
    doc.save();
    doc.roundedRect(dateX, y, halfW, sigBoxH, 4).fill('#fafbff');
    doc.restore();
    doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7.5)
       .text('DATE SIGNED', dateX + 12, y + 8, { width: halfW - 24, characterSpacing: 1.2 });
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(15)
       .text(dateOnly || '', dateX + 12, y + 22, { width: halfW - 24 });
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(10)
       .text((timeOnly || '') + ' EST', dateX + 12, y + 42, { width: halfW - 24 });

    // Green "Electronically Signed" badge bottom-right
    const badgeW = 145, badgeH = 18;
    const badgeX = dateX + halfW - badgeW - 12;
    const badgeY = y + sigBoxH - badgeH - 8;
    doc.save();
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 9).fill('#dcfce7');
    doc.restore();
    doc.fillColor('#15803d').font('Helvetica-Bold').fontSize(8.5)
       .text('✓  ELECTRONICALLY SIGNED', badgeX, badgeY + 5,
             { width: badgeW, align: 'center', characterSpacing: 0.8 });

    y += sigBoxH;

    // ---------- Footer ----------
    const footY = doc.page.height - PAGE.margin - 22;
    doc.save();
    doc.moveTo(X, footY).lineTo(X + W, footY).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.restore();
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
       .text('Mahere Capital', X, footY + 6, { width: W / 2 });
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
       .text('REF: ' + reference, X + W / 2, footY + 6, { width: W / 2, align: 'right' });

    doc.end();
  });
}

// --- Back-compat shim so existing calls don't break ---
async function htmlToPdf(_html, opts = {}) {
  if (opts && opts.data) {
    return renderApplicationPdf({
      data: opts.data,
      rep: opts.rep || {},
      reference: opts.reference || '',
      dateOnly: opts.dateOnly,
      timeOnly: opts.timeOnly,
    });
  }
  // Return a tiny placeholder if called without data
  return Buffer.from('%PDF-1.4\n% Placeholder\n%%EOF\n');
}

async function shutdown() {}

module.exports = { renderApplicationPdf, htmlToPdf, shutdown };
