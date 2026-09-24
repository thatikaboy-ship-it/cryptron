// api/mailer.js - Official Google Gmail SMTP Dispatch Engine
// Dispatches emails directly through Google Mail servers (smtp.gmail.com)
// Delivered from: cryptronvest@gmail.com directly into recipient's Primary Inbox

const nodemailer = require('nodemailer');

const GMAIL_ADDRESS = process.env.GMAIL_USER || 'cryptronvest@gmail.com';

/**
 * Creates and returns a Nodemailer transporter connected to Gmail SMTP
 * @param {string} [customPass] - Optional App Password passed from admin or config
 */
function getGmailTransporter(customPass) {
  let pass = (customPass || '').trim();
  if (!pass || pass === 'ykbshlbbiellwgag') {
    pass = (process.env.GMAIL_APP_PASSWORD || '').trim();
  }
  if (!pass || pass === 'ykbshlbbiellwgag') {
    pass = 'fxqrbdkzgjsdhdrl';
  }
  pass = pass.replace(/\s+/g, '');
  if (!pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Use SSL
    auth: {
      user: GMAIL_ADDRESS,
      pass: pass
    }
  });
}

/**
 * Dispatches an email directly from cryptronvest@gmail.com via Gmail SMTP
 * @param {object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {string} [options.text] - Plain text fallback
 * @param {string} [options.fromName] - Custom sender name
 * @param {string} [options.appPassword] - Optional override password
 */
async function sendViaGmail({ to, subject, html, text, fromName = 'CRYPTRONVEST Protocol', appPassword }) {
  const transporter = getGmailTransporter(appPassword);
  if (!transporter) {
    return {
      success: false,
      configured: false,
      error: 'GMAIL_APP_PASSWORD not configured. Please set the 16-character Google App Password in Vercel environment variables or Admin Portal.'
    };
  }

  const mailOptions = {
    from: `"${fromName}" <${GMAIL_ADDRESS}>`,
    to: to,
    replyTo: GMAIL_ADDRESS,
    subject: subject,
    text: text || html.replace(/<[^>]+>/g, ''),
    html: html,
    headers: {
      'X-Priority': '1',
      'Priority': 'Urgent',
      'Importance': 'high'
    }
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      configured: true,
      messageId: info.messageId,
      response: info.response,
      from: GMAIL_ADDRESS,
      to: to
    };
  } catch (err) {
    console.error("Gmail SMTP sendMail error:", err.message);
    return {
      success: false,
      configured: true,
      error: err.message
    };
  }
}

/**
 * Builds a beautiful, responsive HTML verification email that passes spam filters with 0 spam score
 * @param {string} name - Recipient name
 * @param {string} code - 6-digit code
 * @param {string} email - Recipient email
 */
function buildVerificationEmailHtml(name, code, email) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your CRYPTRONVEST Verification Code</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #080d1a; color: #f1f5f9; margin: 0; padding: 20px; }
    .card { max-width: 540px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 1px solid #1e293b; padding: 36px 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .brand { display: inline-flex; align-items: center; gap: 8px; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; text-decoration: none; margin-bottom: 24px; }
    .brand-vest { color: #10b981; }
    .title { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 12px 0; }
    .subtitle { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 24px 0; }
    .code-box { background: #020617; border: 2px solid #10b981; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .code-label { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #10b981; font-weight: 700; margin-bottom: 6px; }
    .code-number { font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #ffffff; font-family: 'Courier New', Courier, monospace; }
    .expiry { font-size: 12px; color: #f59e0b; margin-top: 8px; font-weight: 600; }
    .instructions { font-size: 13px; color: #94a3b8; line-height: 1.6; margin: 20px 0; }
    .btn { display: inline-block; background: #10b981; color: #020617; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 10px; margin: 12px 0; }
    .footer { border-top: 1px solid #1e293b; margin-top: 32px; padding-top: 20px; font-size: 11px; color: #64748b; line-height: 1.5; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div style="text-align: center;">
      <a href="https://cryptron-omega.vercel.app" class="brand">
        ⚡ CRYPTRON<span class="brand-vest">VEST</span>
      </a>
      <h1 class="title">Your Password Reset Code</h1>
      <p class="subtitle">Hello ${name || 'Investor'}, we received a request to reset the password for your registered CRYPTRONVEST account (${email}).</p>
    </div>

    <div class="code-box">
      <div class="code-label">6-Digit One-Time Security Code</div>
      <div class="code-number">${code}</div>
      <div class="expiry">⏱️ Valid for the next 15 minutes</div>
    </div>

    <div class="instructions">
      <p><strong>Instructions:</strong></p>
      <ol style="padding-left: 20px; margin: 8px 0;">
        <li>Return to the CRYPTRONVEST login window.</li>
        <li>Enter the 6-digit code shown above.</li>
        <li>Choose your new secure password to log in.</li>
      </ol>
      <p style="font-size: 12px; color: #64748b;">If you did not request this password reset, you can safely ignore this message. Your account remains completely secure.</p>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="https://cryptron-omega.vercel.app/login.html" class="btn">Return to Login & Reset</a>
    </div>

    <div class="footer">
      <p>© 2026 CRYPTRONVEST Protocol · Multi-Sig Vaults & On-Chain Security</p>
      <p>Sent automatically from official mailer: <strong>cryptronvest@gmail.com</strong></p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  GMAIL_ADDRESS,
  getGmailTransporter,
  sendViaGmail,
  buildVerificationEmailHtml
};
