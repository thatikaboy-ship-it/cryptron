// Vercel Serverless Function: api/send-reset-code.js
// Dispatches password reset security code to user's registered email

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
    const { email, name, code, subject, message } = body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Missing required parameters: email and code' });
    }

    const recipientEmail = String(email).trim().toLowerCase();
    const recipientName = String(name || 'Investor').trim();
    const resetCode = String(code).trim();
    const emailSubject = subject || `🔐 Your CRYPTRONVEST Verification Code: ${resetCode}`;
    const emailBody = message || `Hello ${recipientName},\n\nYour 6-digit verification code to reset your CRYPTRONVEST account password is:\n\n${resetCode}\n\nThis code expires in 15 minutes.\n\nWarm regards,\nThe CRYPTRONVEST Security Team`;

    const tasks = [];

    // 1. Dispatch FormSubmit notification to cryptronvest@gmail.com with the code
    tasks.push(
      fetch('https://formsubmit.co/ajax/cryptronvest@gmail.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: `🔐 CLIENT PASSWORD RESET: ${recipientName} (${recipientEmail}) - Code: ${resetCode}`,
          _captcha: 'false',
          _template: 'table',
          _replyto: recipientEmail,
          name: recipientName,
          email: recipientEmail,
          "Client Email": recipientEmail,
          "6-Digit Verification Code": resetCode,
          "Expires In": "15 Minutes",
          "Generated At": new Date().toISOString(),
          "Platform": "CRYPTRONVEST Protocol",
          message: emailBody
        })
      }).then(r => r.json()).catch(err => {
        console.warn('FormSubmit admin notice err:', err);
      })
    );

    // 2. Direct dispatch to user's registered email
    tasks.push(
      fetch(`https://formsubmit.co/ajax/${encodeURIComponent(recipientEmail)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: emailSubject,
          _captcha: 'false',
          _template: 'table',
          name: recipientName,
          email: recipientEmail,
          "Verification Code": resetCode,
          "Valid For": "15 Minutes",
          "Platform": "CRYPTRONVEST Protocol",
          "Action Required": `Enter code ${resetCode} on the login page to reset your password.`,
          message: emailBody
        })
      }).then(r => r.json()).catch(err => {
        console.warn('FormSubmit user dispatch err:', err);
      })
    );

    // Await all dispatches (allow graceful continuation)
    await Promise.allSettled(tasks);

    return res.status(200).json({
      success: true,
      message: `Verification code successfully dispatched to ${recipientEmail}`,
      recipient: recipientEmail,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('send-reset-code error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
