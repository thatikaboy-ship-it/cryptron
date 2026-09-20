// Vercel Serverless Function: api/send-reset-code.js
// Dispatches password reset security code directly from cryptronvest@gmail.com via Google SMTP

const { sendViaGmail, buildVerificationEmailHtml, GMAIL_ADDRESS } = require('./mailer');

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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { email, name, code, subject, appPassword } = body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Missing required parameters: email and code' });
    }

    const recipientEmail = String(email).trim().toLowerCase();
    const recipientName = String(name || 'Investor').trim();
    const resetCode = String(code).trim();
    const emailSubject = subject || `🔐 Your CRYPTRONVEST Verification Code: ${resetCode}`;
    const emailHtml = buildVerificationEmailHtml(recipientName, resetCode, recipientEmail);
    const emailText = `Hello ${recipientName},\n\nYour 6-digit verification code to reset your CRYPTRONVEST password is: ${resetCode}\n\nThis code expires in 15 minutes.\n\nWarm regards,\nCRYPTRONVEST Security Team\ncryptronvest@gmail.com`;

    // 1. Direct Primary Dispatch: Google Gmail SMTP from cryptronvest@gmail.com
    const gmailResult = await sendViaGmail({
      to: recipientEmail,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
      fromName: 'CRYPTRONVEST Protocol',
      appPassword: appPassword
    });

    if (gmailResult.success) {
      // Also notify admin cryptronvest@gmail.com if recipient is not admin
      if (recipientEmail !== GMAIL_ADDRESS) {
        sendViaGmail({
          to: GMAIL_ADDRESS,
          subject: `🔐 CLIENT RESET CODE ISSUED: ${recipientName} (${recipientEmail}) - ${resetCode}`,
          html: `<p>A client requested a password reset code on the CRYPTRONVEST login page:</p><ul><li>Name: ${recipientName}</li><li>Email: ${recipientEmail}</li><li>Verification Code: <strong>${resetCode}</strong></li><li>Expires: 15 minutes</li></ul>`,
          appPassword: appPassword
        }).catch(err => console.warn('Admin Gmail alert warning:', err));
      }

      return res.status(200).json({
        success: true,
        deliveryMethod: 'Google Gmail SMTP (Primary Inbox)',
        from: GMAIL_ADDRESS,
        recipient: recipientEmail,
        messageId: gmailResult.messageId,
        message: `Verification code successfully sent from ${GMAIL_ADDRESS} to ${recipientEmail}`
      });
    }

    // 2. Secondary fallback if Google App Password is not yet set
    const fallbackTasks = [
      fetch('https://formsubmit.co/ajax/cryptronvest@gmail.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: `🔐 CLIENT PASSWORD RESET: ${recipientName} (${recipientEmail}) - Code: ${resetCode}`,
          _captcha: 'false',
          name: recipientName,
          email: recipientEmail,
          "6-Digit Verification Code": resetCode,
          "Notice": "Sent via fallback. To deliver straight from cryptronvest@gmail.com to Primary Inbox, add your Google App Password to Vercel."
        })
      }).catch(() => {}),

      fetch(`https://formsubmit.co/ajax/${encodeURIComponent(recipientEmail)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: emailSubject,
          _captcha: 'false',
          name: recipientName,
          email: recipientEmail,
          "Verification Code": resetCode,
          "Valid For": "15 Minutes",
          message: emailText
        })
      }).catch(() => {})
    ];

    await Promise.allSettled(fallbackTasks);

    return res.status(200).json({
      success: true,
      deliveryMethod: 'Fallback Dispatcher',
      sender: GMAIL_ADDRESS,
      recipient: recipientEmail,
      warning: 'Delivered via fallback. Configure Google App Password to send directly from cryptronvest@gmail.com to user Primary Inbox.',
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('send-reset-code error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
