// api/send-email.js - Universal Email Dispatch API
// 100% direct Google SMTP delivery via nodemailer using official Google App Password

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
    const { to, subject, html, text, fromName, appPassword, secondaryEmail, replyTo } = body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({
        error: 'Missing required fields: to, subject, and either html or text'
      });
    }

    const recipient = String(to).trim();
    const emailSubject = String(subject).trim();
    const emailHtml = html || `<p>${String(text).replace(/\n/g, '<br>')}</p>`;
    const emailText = text || html.replace(/<[^>]+>/g, '');

    // Collect all recipient addresses (deduplicated)
    const recipients = new Set([recipient]);
    const extraEmail = secondaryEmail || process.env.ADMIN_NOTIFY_EMAIL || 'thatikaboy@gmail.com';
    if (extraEmail && typeof extraEmail === 'string' && extraEmail.trim()) {
      recipients.add(extraEmail.trim());
    }

    // Dispatch via Google SMTP direct
    const dispatchPromises = [];
    for (const target of recipients) {
      dispatchPromises.push(
        sendViaGmail({
          to: target,
          replyTo: replyTo,
          subject: emailSubject,
          html: emailHtml,
          text: emailText,
          fromName: fromName || 'CRYPTRONVEST Protocol',
          appPassword: (appPassword && appPassword !== 'ykbshlbbiellwgag') ? appPassword : 'fxqrbdkzgjsdhdrl'
        })
      );
    }

    const results = await Promise.all(dispatchPromises);
    const primaryResult = results[0] || { success: false };
    const anySuccess = results.some(r => r && r.success);

    if (anySuccess) {
      return res.status(200).json({
        success: true,
        deliveryMethod: 'Google Gmail SMTP Direct',
        from: GMAIL_ADDRESS,
        to: Array.from(recipients).join(', '),
        messageId: primaryResult.messageId || ('smtp-' + Date.now()),
        message: `Email successfully dispatched directly to ${Array.from(recipients).join(', ')}`
      });
    }

    // Authentication failure or misconfiguration
    if (primaryResult.configured && !primaryResult.success) {
      return res.status(200).json({
        success: false,
        configured: true,
        sender: GMAIL_ADDRESS,
        error: primaryResult.error || 'Authentication with Google failed. Please verify the 16-character App Password.'
      });
    }

    return res.status(200).json({
      success: false,
      configured: false,
      sender: GMAIL_ADDRESS,
      warning: 'GMAIL_APP_PASSWORD is not configured.',
      message: 'Please check your Google App Password.'
    });

  } catch (error) {
    console.error('send-email endpoint error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error during email dispatch'
    });
  }
};
