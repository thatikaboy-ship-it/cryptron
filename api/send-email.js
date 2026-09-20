// api/send-email.js - Universal Email Dispatch API
// Sends emails directly from cryptronvest@gmail.com using Google SMTP

const { sendViaGmail, GMAIL_ADDRESS } = require('./mailer');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { to, subject, html, text, fromName, appPassword } = body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({
        error: 'Missing required fields: to, subject, and either html or text'
      });
    }

    const recipient = String(to).trim();
    const emailSubject = String(subject).trim();
    const emailHtml = html || `<p>${String(text).replace(/\n/g, '<br>')}</p>`;
    const emailText = text || html.replace(/<[^>]+>/g, '');

    // 1. Primary: Direct delivery via Google SMTP (cryptronvest@gmail.com)
    const result = await sendViaGmail({
      to: recipient,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
      fromName: fromName || 'CRYPTRONVEST Protocol',
      appPassword: appPassword
    });

    if (result.success) {
      return res.status(200).json({
        success: true,
        deliveryMethod: 'Gmail SMTP Direct',
        from: GMAIL_ADDRESS,
        to: recipient,
        messageId: result.messageId,
        message: `Email successfully dispatched directly from ${GMAIL_ADDRESS} to ${recipient}`
      });
    }

    // 2. Fallback response if Gmail App Password is not yet provided
    return res.status(200).json({
      success: false,
      configured: false,
      sender: GMAIL_ADDRESS,
      warning: 'GMAIL_APP_PASSWORD is not yet configured in Vercel or request.',
      message: 'To enable 100% direct inbox delivery from cryptronvest@gmail.com, please add your 16-character Google App Password in Vercel Environment Variables or Admin Portal.'
    });

  } catch (error) {
    console.error('send-email endpoint error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error during email dispatch'
    });
  }
};
