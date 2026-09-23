// api/send-email.js - Universal Email Dispatch API
// Sends emails directly from cryptronvest@gmail.com using Google SMTP and FormSubmit dual-dispatch

const https = require('https');
const { sendViaGmail, GMAIL_ADDRESS } = require('./mailer');

/**
 * Dispatches form data to FormSubmit via server-side HTTPS
 */
function postToFormSubmit(targetEmail, payload) {
  return new Promise((resolve) => {
    try {
      const data = JSON.stringify(payload);
      const cleanEmail = String(targetEmail || GMAIL_ADDRESS).trim();
      const options = {
        hostname: 'formsubmit.co',
        port: 443,
        path: `/ajax/${cleanEmail}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'Referer': 'https://cryptron-omega.vercel.app/',
          'Origin': 'https://cryptron-omega.vercel.app',
          'User-Agent': 'Cryptronvest-Protocol-Mailer/1.0'
        },
        timeout: 9000
      };

      const req = https.request(options, (res) => {
        let resBody = '';
        res.on('data', chunk => resBody += chunk);
        res.on('end', () => {
          try {
            resolve({ success: true, data: JSON.parse(resBody) });
          } catch(e) {
            resolve({ success: true, data: resBody });
          }
        });
      });

      req.on('error', (err) => {
        console.warn('FormSubmit server dispatch error:', err.message);
        resolve({ success: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'FormSubmit timeout' });
      });

      req.write(data);
      req.end();
    } catch(err) {
      resolve({ success: false, error: err.message });
    }
  });
}

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
    const { to, subject, html, text, fromName, appPassword, formData } = body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({
        error: 'Missing required fields: to, subject, and either html or text'
      });
    }

    const recipient = String(to).trim();
    const emailSubject = String(subject).trim();
    const emailHtml = html || `<p>${String(text).replace(/\n/g, '<br>')}</p>`;
    const emailText = text || html.replace(/<[^>]+>/g, '');
    const isAdminTarget = recipient.toLowerCase() === GMAIL_ADDRESS.toLowerCase() || recipient.toLowerCase().includes('cryptronvest');

    // Run primary Google SMTP dispatch
    const gmailPromise = sendViaGmail({
      to: recipient,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
      fromName: fromName || 'CRYPTRONVEST Protocol',
      appPassword: appPassword
    });

    // Run server-side FormSubmit if sending to admin
    let formSubmitPromise = Promise.resolve(null);
    if (isAdminTarget) {
      const formPayload = {
        _subject: emailSubject,
        _captcha: "false",
        _template: "table",
        message: emailText,
        ...(formData || {})
      };
      formSubmitPromise = postToFormSubmit(recipient, formPayload);
    }

    // Await both dispatches concurrently
    const [result, formResult] = await Promise.all([gmailPromise, formSubmitPromise]);

    if (result.success || (formResult && formResult.success)) {
      return res.status(200).json({
        success: true,
        deliveryMethod: result.success ? 'Gmail SMTP Direct + FormSubmit' : 'FormSubmit Server Fallback',
        from: GMAIL_ADDRESS,
        to: recipient,
        messageId: result.messageId || ('formsubmit-' + Date.now()),
        formSubmitSuccess: !!(formResult && formResult.success),
        message: `Email successfully dispatched directly to ${recipient}`
      });
    }

    // 2. Authentication failure or misconfiguration
    if (result.configured && !result.success) {
      return res.status(200).json({
        success: false,
        configured: true,
        sender: GMAIL_ADDRESS,
        error: result.error || 'Authentication with Google failed. Please check your 16-character App Password.'
      });
    }

    // 3. Fallback response if Gmail App Password is not yet provided
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
