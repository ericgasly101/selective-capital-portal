require('dotenv').config();

const path        = require('path');
const fs          = require('fs');
const express     = require('express');
const multer      = require('multer');
const rateLimit   = require('express-rate-limit');

const { getRep, REPS } = require('./reps');
const { sendMail }     = require('./mailer');
const { buildMahereAppEmail } = require('./mahereTemplate');
const { renderApplicationPdf } = require('./pdfRender');

const app  = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
// Static merchant-facing files (served from the project root, not public/)
const _staticFiles = new Set(['styles.css','apply.js','upload.js','logo.png','logo.svg','mahere-logo.png']);
app.get('/:file', (req, res, next) => {
  if (!_staticFiles.has(req.params.file)) return next();
  res.sendFile(path.join(__dirname, req.params.file));
});

// Light rate-limit on submission endpoints (10 / 15 min / IP)
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many submissions, please try again in a few minutes.' },
});

// ---------- Multer (in-memory file uploads) ----------
const MAX_FILE_MB = parseInt(process.env.MAX_FILE_MB || '15', 10);
const MAX_FILES = parseInt(process.env.MAX_FILES || '30', 10);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_MB * 1024 * 1024,
    files: MAX_FILES,
    fields: 50,
  },
  fileFilter: (req, file, cb) => {
    // Accept common doc/image types
    const ok = /^(image\/(png|jpe?g|gif|heic|heif|webp)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|text\/plain)$/i
      .test(file.mimetype);
    if (!ok) return cb(new Error('Unsupported file type: ' + file.mimetype));
    cb(null, true);
  },
});

// ---------- Helpers ----------
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bytesToHuman(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

function tsString() {
  return new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
}

// ---------- Subdomain routing ----------
// application.selectivecap.com/<rep>  →  internally /apply/<rep>
// docupload.selectivecap.com/<rep>    →  internally /upload/<rep>
const APPLY_HOSTS  = new Set(['application.selectivecap.com']);
const UPLOAD_HOSTS = new Set(['docupload.selectivecap.com']);
app.use((req, res, next) => {
  const host = (req.headers.host || '').toLowerCase().split(':')[0];
  const pathOnly = req.url.split('?')[0];
  // Skip rewrite for API, already-prefixed paths, and static files
  if (pathOnly === '/' ||
      pathOnly.startsWith('/api/') ||
      pathOnly.startsWith('/apply/') ||
      pathOnly.startsWith('/upload/') ||
      pathOnly.startsWith('/healthz') ||
      /\.(css|js|png|svg|ico|jpe?g|gif|webp)$/i.test(pathOnly)) {
    return next();
  }
  if (APPLY_HOSTS.has(host))       req.url = '/apply'  + req.url;
  else if (UPLOAD_HOSTS.has(host)) req.url = '/upload' + req.url;
  next();
});

// ---------- Page routes ----------

// Home / index — lists rep links so an admin can copy them
app.get('/', (req, res) => {
  const base = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
  const rows = Object.entries(REPS).map(([slug, r]) => `
    <tr>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.email)}</td>
      <td><a href="/upload/${slug}">${base}/upload/${slug}</a></td>
      <td><a href="/apply/${slug}">${base}/apply/${slug}</a></td>
    </tr>`).join('');
  res.send(`<!doctype html><html><head><meta charset="utf-8">
    <title>Selective Capital Portal — Admin</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:980px;margin:40px auto;padding:0 20px;color:#0f172a}
      table{border-collapse:collapse;width:100%;font-size:14px}
      th,td{border:1px solid #e2e8f0;padding:10px 12px;text-align:left}
      th{background:#f8fafc}
      h1{margin-bottom:6px}
      .muted{color:#64748b;font-size:14px}
      a{color:#1e40af}
    </style></head><body>
    <h1>Selective Capital Portal</h1>
    <p class="muted">Share these personalized links with each rep. The merchant clicks the link → their submission emails the right rep automatically.</p>
    <table>
      <thead><tr><th>Rep</th><th>Email</th><th>Upload Portal Link</th><th>Application Link</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="muted" style="margin-top:24px">Server time: ${escapeHtml(tsString())}</p>
    </body></html>`);
});

// Upload portal page (per-rep)
app.get('/upload/:rep', (req, res) => {
  const rep = getRep(req.params.rep);
  if (!rep) return res.status(404).send('Unknown rep link. Please check your URL.');
  res.sendFile(path.join(__dirname, 'upload.html'));
});

// Application page (per-rep)
app.get('/apply/:rep', (req, res) => {
  const rep = getRep(req.params.rep);
  if (!rep) return res.status(404).send('Unknown rep link. Please check your URL.');
  res.sendFile(path.join(__dirname, 'apply.html'));
});

// Health
app.get('/healthz', (req, res) => res.json({ ok: true, ts: Date.now() }));

// ---------- API: which rep is this slug? (used by frontend) ----------
app.get('/api/rep/:rep', (req, res) => {
  const rep = getRep(req.params.rep);
  if (!rep) return res.status(404).json({ ok: false, error: 'Unknown rep' });
  res.json({ ok: true, name: rep.name, email: rep.email });
});

// ---------- API: Upload submission ----------
app.post('/api/upload/:rep', submitLimiter, upload.any(), async (req, res) => {
  try {
    const rep = getRep(req.params.rep);
    if (!rep) return res.status(404).json({ ok: false, error: 'Unknown rep' });

    const {
      businessName = '',
      contactName  = '',
      contactEmail = '',
      contactPhone = '',
      notes        = '',
    } = req.body || {};

    if (!businessName || !contactName || !contactEmail) {
      return res.status(400).json({ ok: false, error: 'Business name, contact name, and email are required.' });
    }

    const files = (req.files || []).map(f => ({
      filename: f.originalname,
      content:  f.buffer,
      contentType: f.mimetype,
      _field:   f.fieldname,
      _size:    f.size,
    }));

    if (files.length === 0) {
      return res.status(400).json({ ok: false, error: 'Please attach at least one document.' });
    }

    // Build human-readable file list grouped by category
    const byCategory = {};
    for (const f of files) {
      (byCategory[f._field] ||= []).push(f);
    }
    const categoryLabel = {
      bankStatements: 'Bank Statements',
      driversLicense: "Driver's License",
      voidedCheck:    'Voided Check',
      other:          'Other Documents',
    };
    const fileListHtml = Object.entries(byCategory).map(([cat, list]) => `
      <li><strong>${escapeHtml(categoryLabel[cat] || cat)}:</strong>
        <ul>${list.map(f => `<li>${escapeHtml(f.filename)} <span style="color:#64748b">(${bytesToHuman(f._size)})</span></li>`).join('')}</ul>
      </li>`).join('');

    const subject = `[Selective Capital] Documents from ${businessName} — ${files.length} file${files.length === 1 ? '' : 's'}`;
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:640px">
        <div style="background:#0f1e44;color:#fff;padding:18px 22px;border-radius:8px 8px 0 0">
          <h2 style="margin:0;font-size:18px;letter-spacing:.3px">Mahere Capital — New Document Submission</h2>
          <div style="font-size:12px;opacity:.85;margin-top:4px">via Selective Capital upload portal</div>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:0;padding:20px;border-radius:0 0 8px 8px">
          <p>Rep: <strong>${escapeHtml(rep.name)}</strong> &lt;${escapeHtml(rep.email)}&gt;</p>
          <h3 style="margin-bottom:6px">Merchant</h3>
          <table style="border-collapse:collapse;font-size:14px">
            <tr><td style="padding:4px 12px 4px 0;color:#64748b">Business</td><td>${escapeHtml(businessName)}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#64748b">Contact</td><td>${escapeHtml(contactName)}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#64748b">Email</td><td>${escapeHtml(contactEmail)}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#64748b">Phone</td><td>${escapeHtml(contactPhone)}</td></tr>
          </table>
          ${notes ? `<h3 style="margin-bottom:6px">Notes</h3><p style="white-space:pre-wrap">${escapeHtml(notes)}</p>` : ''}
          <h3 style="margin-bottom:6px">Attached Documents (${files.length})</h3>
          <ul>${fileListHtml}</ul>
          <p style="color:#64748b;font-size:12px;margin-top:16px">Submitted ${escapeHtml(tsString())} ET</p>
        </div>
      </div>`;

    const text = [
      `Mahere Capital — New Document Submission`,
      `Rep: ${rep.name} <${rep.email}>`,
      ``,
      `Business: ${businessName}`,
      `Contact:  ${contactName}`,
      `Email:    ${contactEmail}`,
      `Phone:    ${contactPhone}`,
      notes ? `\nNotes:\n${notes}` : '',
      ``,
      `Files attached: ${files.length}`,
      ...files.map(f => `  - ${f.filename} (${bytesToHuman(f._size)})`),
    ].filter(Boolean).join('\n');

    await sendMail({
      to: rep.email,
      replyTo: contactEmail,
      subject,
      html,
      text,
      attachments: files.map(f => ({
        filename:    f.filename,
        content:     f.content,
        contentType: f.contentType,
      })),
    });

    res.json({ ok: true, message: 'Documents sent to your rep.' });
  } catch (err) {
    console.error('[upload] error', err);
    res.status(500).json({ ok: false, error: err.message || 'Upload failed' });
  }
});

// ---------- API: Application submission ----------
app.post('/api/apply/:rep', submitLimiter, express.json({ limit: '256kb' }), async (req, res) => {
  try {
    const rep = getRep(req.params.rep);
    if (!rep) return res.status(404).json({ ok: false, error: 'Unknown rep' });

    const data = req.body || {};

    // Minimal validation
    const required = ['businessName', 'ownerFirstName', 'ownerLastName', 'ownerEmail', 'requestedAmount'];
    const missing = required.filter(k => !String(data[k] || '').trim());
    if (missing.length) {
      return res.status(400).json({ ok: false, error: 'Missing fields: ' + missing.join(', ') });
    }

    const { html, text, subject, jsonAttachment, formalHtml, reference } = buildMahereAppEmail({ data, rep });

    const safeBiz = (data.businessName || 'application')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'application';

    // Render the formal Mahere application to a real PDF (signed/dated by template)
    let pdfBuffer;
    try {
      pdfBuffer = await renderApplicationPdf({ data, rep, reference, dateOnly: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }), timeOnly: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }) });
    } catch (pdfErr) {
      console.error('[apply] PDF render failed', pdfErr);
      return res.status(500).json({ ok: false, error: 'Could not generate PDF — ' + pdfErr.message });
    }

    await sendMail({
      to: rep.email,
      replyTo: data.ownerEmail,
      subject,
      html,
      text,
      attachments: [
        {
          filename: `mahere-application-${safeBiz}-${reference}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
        {
          filename: `mahere-application-${safeBiz}-${reference}.json`,
          content: JSON.stringify(jsonAttachment, null, 2),
          contentType: 'application/json',
        },
      ],
    });

    res.json({ ok: true, message: 'Application sent to your rep.' });
  } catch (err) {
    console.error('[apply] error', err);
    res.status(500).json({ ok: false, error: err.message || 'Submission failed' });
  }
});

// ---------- 404 ----------
app.use((req, res) => res.status(404).send('Not found.'));

// ---------- Error handler (multer & friends) ----------
app.use((err, req, res, next) => {
  console.error('[error]', err);
  if (err && err.message && err.message.startsWith('File too large')) {
    return res.status(413).json({ ok: false, error: `File too large (limit ${MAX_FILE_MB} MB).` });
  }
  res.status(500).json({ ok: false, error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Selective Capital portal listening on :${PORT}`);
  console.log(`Reps:`, Object.keys(REPS).join(', '));
});
