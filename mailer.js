// Sends email via Resend's HTTPS API (port 443 — bypasses any SMTP port blocks).

async function sendMail({ to, subject, html, text, attachments, replyTo, bcc }) {
  const apiKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
  const from   = process.env.MAIL_FROM || 'Selective Capital Portal <portal@selectivecap.com>';

  if (!apiKey) throw new Error('RESEND_API_KEY (or SMTP_PASS) is not set');

  const apiAttachments = (attachments || []).map(a => {
    const buf = Buffer.isBuffer(a.content) ? a.content : Buffer.from(String(a.content), 'utf8');
    return { filename: a.filename, content: buf.toString('base64') };
  });

  const payload = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
    reply_to: replyTo,
    bcc: bcc || (process.env.MAIL_BCC || undefined),
    attachments: apiAttachments.length ? apiAttachments : undefined,
  };

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const errBody = await r.text();
    throw new Error('Resend API ' + r.status + ': ' + errBody);
  }
  return r.json();
}

module.exports = { sendMail };
