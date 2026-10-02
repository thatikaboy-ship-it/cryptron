// api/send-email.js - Universal Email Dispatch & Cloud Persistence API
// 100% direct Google SMTP delivery via nodemailer using official Google App Password
// Automatically persists new user registrations directly to Firebase Realtime Database

const https = require('https');
const { sendViaGmail, GMAIL_ADDRESS } = require('./mailer');

const FIREBASE_DB_HOST = "cryptron-a4523-default-rtdb.firebaseio.com";

/**
 * Perform HTTPS requests to Firebase Realtime Database directly from backend Node.js
 * Works universally on Vercel serverless without external SDK dependencies
 */
function firebaseRequest(method, path, data) {
  return new Promise((resolve) => {
    try {
      const payload = data ? JSON.stringify(data) : null;
      const options = {
        hostname: FIREBASE_DB_HOST,
        port: 443,
        path: path.startsWith('/') ? path : `/${path}`,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      if (payload) {
        options.headers['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = https.request(options, (res) => {
        let respData = '';
        res.on('data', chunk => { respData += chunk; });
        res.on('end', () => {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, data: respData });
        });
      });

      req.on('error', (err) => {
        console.warn(`Firebase ${method} ${path} error:`, err.message);
        resolve({ ok: false, error: err.message });
      });

      req.setTimeout(4000, () => {
        req.destroy();
        resolve({ ok: false, error: 'Firebase timeout' });
      });

      if (payload) req.write(payload);
      req.end();
    } catch (e) {
      console.warn(`Firebase exception for ${path}:`, e.message);
      resolve({ ok: false, error: e.message });
    }
  });
}

/**
 * Persist user record directly into Firebase active users and permanent registrations audit log
 */
async function persistUserToFirebase(user) {
  if (!user || !user.email) return;

  const cleanEmail = String(user.email).toLowerCase().trim();
  const safeEmailKey = cleanEmail.replace(/[.#$\[\]\/]/g, '_');
  let cleanId = user.id ? String(user.id).trim() : null;

  // Ensure ID doesn't collide with historical deleted IDs (1001-1063)
  if (!cleanId || /^USR-10[0-5][0-9]$|^USR-106[0-3]$/i.test(cleanId)) {
    cleanId = "USR-" + (Date.now().toString().slice(-4));
  }

  const cleanUser = {
    id: cleanId,
    name: (user.name || 'New Client').trim(),
    email: cleanEmail,
    password: user.password || 'password123',
    passwordMasked: '••••••••',
    registeredAt: user.registeredAt || new Date().toISOString().replace('T', ' ').substring(0, 19),
    walletAddress: user.walletAddress || ("0x" + Math.random().toString(16).substring(2, 28)),
    promoCode: user.promoCode || ("USER" + Math.floor(1000 + Math.random() * 9000)),
    referralCode: user.referralCode || user.promoCode || ("USER" + Math.floor(1000 + Math.random() * 9000)),
    referralCount: Number(user.referralCount) || 0,
    referredBy: (user.referredBy && user.referredBy !== 'None') ? user.referredBy : null,
    investmentStatus: user.investmentStatus || 'not_invested',
    pendingTxHash: null,
    lastSpinTimestamp: 0,
    totalDeposited: Number(user.totalDeposited) || 0.00,
    availableBalance: Number(user.availableBalance) || 0.00,
    totalProfits: Number(user.totalProfits) || 0.00,
    status: 'Active',
    activePlans: user.activePlans || []
  };

  try {
    // Check existing remote user before writing to avoid overwriting real credentials or active contracts
    const existingRes = await firebaseRequest('GET', `/cryptron_users/${cleanUser.id}.json`);
    const existing = (existingRes && existingRes.ok && existingRes.data && typeof existingRes.data === 'object') ? existingRes.data : null;

    if (existing) {
      if ((!user.password || user.password === 'password123') && existing.password && existing.password !== 'password123') {
        cleanUser.password = existing.password;
      }
      if (existing.investmentStatus === 'active' && cleanUser.investmentStatus === 'not_invested') {
        cleanUser.investmentStatus = 'active';
        cleanUser.activePlans = existing.activePlans || [];
        cleanUser.investedBalance = existing.investedBalance || 10.00;
        cleanUser.totalDeposited = existing.totalDeposited || 10.00;
      }
      if (existing.availableBalance > 0 && cleanUser.availableBalance === 0) {
        cleanUser.availableBalance = existing.availableBalance;
      }
      if (existing.referralCount > 0 && cleanUser.referralCount === 0) {
        cleanUser.referralCount = existing.referralCount;
      }
    }

    // 1. Write to active users
    await firebaseRequest('PUT', `/cryptron_users/${cleanUser.id}.json`, cleanUser);

    // 2. Write to persistent registrations audit trail (never purged)
    await firebaseRequest('PUT', `/cryptron_registrations/${cleanUser.id}.json`, cleanUser);

    // 3. Remove any previous tombstone for this email
    await firebaseRequest('DELETE', `/cryptron_deleted_users/emails/${safeEmailKey}.json`);
    await firebaseRequest('DELETE', `/cryptron_deleted_users/ids/${cleanUser.id}.json`);
    console.log(`Successfully persisted user ${cleanUser.name} (${cleanUser.id} / ${cleanEmail}) to Firebase RTDB`);
  } catch (err) {
    console.warn("persistUserToFirebase error:", err);
  }
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
    const { to, subject, html, text, fromName, appPassword, secondaryEmail, replyTo, userRecord, syncOnly } = body;

    // Handle sync-only requests
    if (syncOnly && userRecord) {
      await persistUserToFirebase(userRecord);
      return res.status(200).json({ success: true, message: 'User synced to Firebase successfully' });
    }

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

    // Email delivery only - NEVER overwrite user databases or mutate passwords from email contents
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
