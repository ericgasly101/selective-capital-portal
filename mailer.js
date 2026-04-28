const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host   = process.env.SMTP_HOST;
  const port   = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true';
  const user   = process.env.SMTP_USER;
  const pass   = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[mailer] SMTP_HOST / SMTP_USER / SMTP_PASS not set. Emails will fail until configured.');
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
  return transporter;
}

async function sendMail({ to, subject, html, text, attachments, replyTo }) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const bcc  = process.env.MAIL_BCC || undefined;

  const info = await getTransporter().sendMail({
    from,
    to,
    bcc,
    subject,
    html,
    text,
    replyTo,
    attachments,
  });
  return info;
}

module.exports = { sendMail };
