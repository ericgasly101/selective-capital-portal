// Sends email via Resend's HTTPS API (port 443 — bypasses any SMTP port blocks).
// Hardened for large attachment payloads:
//  - explicit fetch timeout (default 60s)
//  - logs payload size for triage
//  - if the JSON payload would exceed RESEND_MAX_PAYLOAD_MB, splits the
//    attachments across multiple emails ("Part N of M") so Resend never
//    rejects the request, and the server doesn't OOM building one giant body.

const RESEND_LIMIT_MB  = parseFloat(process.env.RESEND_MAX_PAYLOAD_MB || '20');
const FETCH_TIMEOUT_MS = parseInt(process.env.MAIL_FETCH_TIMEOUT_MS || '60000', 10);

function approxPayloadBytes(attachments) {
  let total = 0;
  for (const a of attachments) {
    const buf = Buffer.isBuffer(a.content) ? a.content : Buffer.from(String(a.content), 'utf8');
    total += Math.ceil(buf.length * 4 / 3);
  }
  return total;
}

function chunkAttachmentsByBytes(attachments, maxBytes) {
  const chunks = [];
  let cur = [], curBytes = 0;
  for (const a of attachments) {
    const buf = Buffer.isBuffer(a.content) ? a.content : Buffer.from(String(a.content), 'utf8');
    const b64Bytes = Math.ceil(buf.length * 4 / 3);
    if (b64Bytes > maxBytes) {
      if (cur.length) { chunks.push(cur); cur = []; curBytes = 0; }
      chunks.push([a]);
      continue;
    }
    if (curBytes + b64Bytes > maxBytes && cur.length) {
      chunks.push(cur); cur = []; curBytes = 0;
    }
    cur.push(a);
    curBytes += b64Bytes;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

async function postOnce({ apiKey, payload }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const errBody = await r.text().catch(() => '');
      throw new Error('Resend API ' + r.status + ': ' + errBody);
    }
    return r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function sendMail({ to, subject, html, text, attachments, replyTo, bcc }) {
  const apiKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
  const from   = process.env.MAIL_FROM || 'Selective Capital Portal <portal@selectivecap.com>';
  if (!apiKey) throw new Error('RESEND_API_KEY (or SMTP_PASS) is not set');

  const list = Array.isArray(to) ? to : [to];
  const safeBcc = bcc || (process.env.MAIL_BCC || undefined);
  const inputAttachments = attachments || [];

  const maxBytes = Math.floor(RESEND_LIMIT_MB * 1024 * 1024);
  const chunks = inputAttachments.length
    ? chunkAttachmentsByBytes(inputAttachments, maxBytes)
    : [[]];

  const totalApprox = approxPayloadBytes(inputAttachments);
  console.log('[mailer] sending to=' + list.join(',') + ' files=' + inputAttachments.length +
              ' base64MB=' + (totalApprox/1024/1024).toFixed(2) +
              ' emails=' + chunks.length);

  const responses = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const partLabel = chunks.length > 1 ? ' (Part ' + (i+1) + ' of ' + chunks.length + ')' : '';

    const apiAttachments = chunk.map(a => {
      const buf = Buffer.isBuffer(a.content) ? a.content : Buffer.from(String(a.content), 'utf8');
      return { filename: a.filename, content: buf.toString('base64') };
    });

    const payload = {
      from,
      to: list,
      subject: subject + partLabel,
      html,
      text,
      reply_to: replyTo,
      bcc: safeBcc,
      attachments: apiAttachments.length ? apiAttachments : undefined,
    };

    const result = await postOnce({ apiKey, payload });
    responses.push(result);
  }
  return responses.length === 1 ? responses[0] : { batch: responses };
}

module.exports = { sendMail };
