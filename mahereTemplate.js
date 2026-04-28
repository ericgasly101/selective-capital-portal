// Generates the Mahere Capital "Funding Application" document, modelled
// after the official PDF template. Returns short email body for the rep
// inbox PLUS the formal PDF-styled HTML attachment.

const { loadLogo } = require('./mahereLogo');

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtMoney(v) {
  const n = Number(String(v || '').replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n) || n === 0) return esc(v || '');
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return esc(d);
  return dt.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function generateRef() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function combineAddr(line, city, state, zip) {
  const parts = [];
  if (line) parts.push(line);
  const cityLine = [city, state, zip].filter(Boolean).join(' ');
  if (cityLine) parts.push(cityLine);
  return parts.join(' ').trim();
}

function fieldRow(label, value) {
  return '<div class="field"><div class="field-label">' + esc(label) + '</div><div class="field-value">' + (value ? esc(value) : '&nbsp;') + '</div></div>';
}

function buildFormalHtml(data, rep, ref, dateOnly, timeOnly) {
  const ownerName = [data.ownerFirstName, data.ownerLastName].filter(Boolean).join(' ').trim();
  const businessAddr = combineAddr(data.businessAddress, data.businessCity, data.businessState, data.businessZip);
  const ownerAddr = combineAddr(data.ownerAddress, data.ownerCity, data.ownerState, data.ownerZip);

  const css = '@page{size:A4;margin:28mm 18mm}*{box-sizing:border-box}'
    + 'body{margin:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased}'
    + '.page{max-width:820px;margin:24px auto;background:#fff;padding:36px 44px 30px;border-radius:6px}'
    + '.doc-header{display:flex;justify-content:space-between;align-items:flex-start}'
    + '.brand{display:flex;align-items:center;gap:10px}'
    + '.brand-text{font-size:13px;font-weight:700;color:#0f1e44;line-height:1.15}'
    + '.brand-text small{display:block;font-weight:600}'
    + '.ref-block{text-align:right;font-size:11px}'
    + '.ref-label{color:#94a3b8;letter-spacing:1.2px;font-weight:600}'
    + '.ref-num{color:#1d4ed8;font-weight:700;font-size:13px;margin-top:2px}'
    + '.ref-date{color:#64748b;margin-top:2px}'
    + 'h1.title{font-size:28px;font-weight:800;margin:22px 0 14px;letter-spacing:-0.4px}'
    + '.title-rule{height:3px;background:#1d4ed8;margin:0 0 22px;border:0}'
    + '.section{border:1px solid #e2e8f0;border-radius:8px;margin-bottom:16px;overflow:hidden}'
    + '.section-head{display:flex;align-items:center;gap:12px;background:#eff6ff;padding:12px 16px;border-bottom:1px solid #e2e8f0}'
    + '.section-num{width:28px;height:28px;border-radius:6px;background:#1d4ed8;color:#fff;font-size:12px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}'
    + '.section-title{color:#1d4ed8;text-transform:uppercase;font-size:13px;font-weight:700;letter-spacing:1.2px}'
    + '.section-body{padding:0 16px}'
    + '.field-row{display:flex;gap:0;border-bottom:1px solid #f1f5f9}'
    + '.field-row:last-child{border-bottom:0}'
    + '.field-row .field{flex:1;padding:12px 16px 12px 0;min-width:0}'
    + '.field-row.split .field{flex:1 1 50%}'
    + '.field-row.split .field+.field{padding-left:16px;border-left:1px solid #f1f5f9}'
    + '.field-label{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.2px;font-weight:600;margin-bottom:6px}'
    + '.field-value{font-size:14px;font-weight:700;color:#0f172a;word-break:break-word}'
    + '.auth-disclaimer{margin:14px 16px;padding:14px 16px;background:#eff6ff;border-left:4px solid #1d4ed8;border-radius:4px;font-size:12.5px;color:#475569;line-height:1.6}'
    + '.signature-row{display:flex;gap:20px;padding:0 16px 16px}'
    + '.signature-row .field{flex:1;padding:6px 0}'
    + '.sig-line{border-bottom:1px solid #cbd5e1;padding-bottom:6px;margin-top:4px}'
    + '.sig-italic{font-family:"Brush Script MT","Lucida Handwriting",cursive;font-size:26px;color:#0f172a;font-weight:400}'
    + '.sig-meta{font-size:11px;color:#64748b;margin-top:6px}'
    + '.doc-footer{margin-top:18px;color:#64748b;font-size:11px}'
    + '.page-foot{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:10px;display:flex;justify-content:space-between;color:#94a3b8;font-size:11px}';

  const logo = loadLogo();

  return '<!doctype html><html><head><meta charset="utf-8"><title>Mahere Capital - Funding Application - Ref ' + esc(ref) + '</title><style>' + css + '</style></head><body><div class="page">'
    + '<div class="doc-header"><div class="brand">' + logo + '</div>'
    + '<div class="ref-block"><div class="ref-label">REFERENCE</div><div class="ref-num">#' + esc(ref) + '</div><div class="ref-date">' + esc(dateOnly) + '</div></div></div>'
    + '<h1 class="title">Funding Application</h1><hr class="title-rule"/>'
    + '<div class="section"><div class="section-head"><span class="section-num">01</span><span class="section-title">Business Information</span></div><div class="section-body">'
    + '<div class="field-row">' + fieldRow('Legal Business Name', (data.businessName || '').toUpperCase()) + '</div>'
    + '<div class="field-row split">' + fieldRow('EIN #', data.ein) + fieldRow('Business Start Date', fmtDate(data.businessStartDate)) + '</div>'
    + '<div class="field-row">' + fieldRow('Legal Entity Type', data.entityType) + '</div>'
    + '<div class="field-row">' + fieldRow('Company Address', (businessAddr || '').toUpperCase()) + '</div>'
    + '</div></div>'
    + '<div class="section"><div class="section-head"><span class="section-num">02</span><span class="section-title">Owner Information</span></div><div class="section-body">'
    + '<div class="field-row split">' + fieldRow('Owner Full Name', ownerName) + fieldRow('Ownership %', data.ownershipPct) + '</div>'
    + '<div class="field-row split">' + fieldRow('SSN #', data.ownerSsn) + fieldRow('Date of Birth', fmtDate(data.ownerDob)) + '</div>'
    + '<div class="field-row">' + fieldRow('Home Address', (ownerAddr || '').toUpperCase()) + '</div>'
    + '<div class="field-row">' + fieldRow('Second Owner (20%-49%)', data.secondOwner || 'None') + '</div>'
    + '</div></div>'
    + '<div class="section"><div class="section-head"><span class="section-num" style="background:#1d4ed8">&#10003;</span><span class="section-title">Authorization &amp; Signature</span></div>'
    + '<div class="auth-disclaimer">By signing below, I certify that I am authorized to apply for funding on behalf of the above Company and that all information provided is true, accurate, and complete. I authorize Mahere Capital and its funding partners to obtain business and personal credit reports in connection with this application. This application does not constitute a commitment to fund.</div>'
    + '<div class="signature-row">'
    + '<div class="field"><div class="field-label">Applicant Signature</div><div class="sig-line"><span class="sig-italic">' + esc(ownerName) + '</span></div><div class="sig-meta">' + esc(ownerName) + '</div></div>'
    + '<div class="field"><div class="field-label">Date Signed</div><div class="sig-line"><span style="font-size:14px;font-weight:600">' + esc(dateOnly) + '</span></div><div class="sig-meta">Electronically signed at ' + esc(timeOnly) + ' EST</div></div>'
    + '</div></div>'
    + '<div class="doc-footer">&#9201; Submitted ' + esc(dateOnly) + ' at ' + esc(timeOnly) + ' EST &middot; Ref #' + esc(ref) + '</div>'
    + '<div class="page-foot"><div>Mahere Capital</div><div>REF: ' + esc(ref) + '</div></div>'
    + '</div></body></html>';
}

function buildEmailHtml(data, rep, ref) {
  const ownerName = [data.ownerFirstName, data.ownerLastName].filter(Boolean).join(' ').trim();
  const fundingLine = data.requestedAmount ? fmtMoney(data.requestedAmount) : 'Not specified';
  const notesBlock = data.notes ? '<div style="margin-top:12px;padding:10px 12px;background:#f8fafc;border-radius:6px;font-size:13px;color:#475569"><strong>Notes:</strong> ' + esc(data.notes) + '</div>' : '';
  const monthlyRow = data.monthlyRevenue ? '<tr><td style="padding:4px 16px 4px 0;color:#64748b">Monthly Revenue</td><td>' + fmtMoney(data.monthlyRevenue) + '</td></tr>' : '';
  const advancesRow = data.existingAdvances ? '<tr><td style="padding:4px 16px 4px 0;color:#64748b">Existing Advances</td><td>' + esc(data.existingAdvances) + (data.existingBalance ? ' (' + fmtMoney(data.existingBalance) + ')' : '') + '</td></tr>' : '';

  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:640px">'
    + '<div style="background:#0f1e44;color:#fff;padding:16px 22px;border-radius:6px 6px 0 0">'
    + '<div style="font-size:18px;font-weight:700">Mahere Capital - New Funding Application</div>'
    + '<div style="font-size:12px;opacity:.85;margin-top:3px">Origination: Selective Capital &middot; Rep: ' + esc(rep.name) + '</div>'
    + '</div>'
    + '<div style="border:1px solid #e2e8f0;border-top:0;padding:18px 22px;border-radius:0 0 6px 6px">'
    + '<table style="border-collapse:collapse;font-size:14px">'
    + '<tr><td style="padding:4px 16px 4px 0;color:#64748b">Reference</td><td style="color:#1d4ed8;font-weight:700">#' + esc(ref) + '</td></tr>'
    + '<tr><td style="padding:4px 16px 4px 0;color:#64748b">Business</td><td><strong>' + esc(data.businessName || '') + '</strong></td></tr>'
    + '<tr><td style="padding:4px 16px 4px 0;color:#64748b">Owner</td><td>' + esc(ownerName) + '</td></tr>'
    + '<tr><td style="padding:4px 16px 4px 0;color:#64748b">Requested</td><td><strong>' + fundingLine + '</strong>' + (data.useOfFunds ? ' &middot; ' + esc(data.useOfFunds) : '') + '</td></tr>'
    + monthlyRow + advancesRow
    + '</table>' + notesBlock
    + '<div style="margin-top:14px;font-size:13px;color:#64748b">Formal Mahere Capital Funding Application is attached. Reply to this email to reach the merchant directly.</div>'
    + '</div></div>';
}

function buildMahereAppEmail({ data, rep }) {
  const ref = generateRef();
  const now = new Date();
  const tsLong = now.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/New_York' });
  const dateOnly = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeOnly = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
  const ownerName = [data.ownerFirstName, data.ownerLastName].filter(Boolean).join(' ').trim();

  const formalHtml = buildFormalHtml(data, rep, ref, dateOnly, timeOnly);
  const emailHtml = buildEmailHtml(data, rep, ref);

  const fundingLine = data.requestedAmount ? fmtMoney(data.requestedAmount) : 'Not specified';
  const subject = '[Mahere Capital] New Application - ' + (data.businessName || 'Unknown') + ' - ' + fundingLine + ' - Ref #' + ref;

  const text = [
    'Mahere Capital - New Funding Application',
    'Reference: #' + ref,
    'Business:  ' + (data.businessName || ''),
    'Owner:     ' + ownerName,
    'Requested: ' + fundingLine + (data.useOfFunds ? ' (' + data.useOfFunds + ')' : ''),
    data.monthlyRevenue ? 'Monthly Revenue: ' + fmtMoney(data.monthlyRevenue) : '',
    data.existingAdvances ? 'Existing Advances: ' + data.existingAdvances : '',
    '',
    data.notes ? 'Notes: ' + data.notes : '',
    'Formal Mahere Capital Funding Application attached.',
    'Submitted ' + tsLong + ' EST - Ref #' + ref,
  ].filter(Boolean).join('\n');

  const jsonAttachment = {
    source: 'selective-capital-portal',
    reference: ref,
    submittedAt: now.toISOString(),
    rep: { name: rep.name, email: rep.email },
    application: data,
  };

  return {
    html: emailHtml,
    text,
    subject,
    jsonAttachment,
    formalHtml,
    reference: ref,
  };
}

module.exports = { buildMahereAppEmail };
