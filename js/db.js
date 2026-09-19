/**
 * CRYPTRON - USER DATABASE ENGINE
 * Handles user registration, credentials storage, manual investment activations,
 * 7-day countdown timers, and admin user directories.
 */

const USERS_DB_KEY = "cryptron_registered_users_v2";
const CURRENT_USER_KEY = "cryptron_current_user_id";
const CLOUD_DB_KEY = "cryptron_cloud_database_url";

// Initial seed database with sample registered users showcasing all 3 states:
// 1. USR-1001: Active 7-day timer running
// 2. USR-1002: Pending Admin Approval ($10 deposit submitted)
// 3. USR-1003: No Investment (New Signup awaiting action)
const SEED_USERS = [
  {
    id: "USR-1001",
    name: "David Miller",
    email: "d.miller@cryptron.io",
    password: "password123",
    passwordMasked: "••••••••",
    registeredAt: "2026-09-12 14:30:22",
    walletAddress: "0x71C839e248bF2190827fA38aB15aF7",
    referralCode: "REF-1001-8821",
    referralCount: 3,
    investmentStatus: "active", // 'active', 'pending_approval', 'not_invested'
    pendingTxHash: null,
    totalDeposited: 10.00,
    availableBalance: 0.00,
    totalProfits: 0.00,
    status: "Active",
    activePlans: [
      {
        id: "cryp-701",
        planName: "7-Day Crypto Yield Vault",
        principal: 10.00,
        totalPayout: 25.00,
        // 5 days, 14 hours left
        maturityTimestamp: Date.now() + (5 * 86400000) + (14 * 3600000) + (32 * 60000),
        createdAt: Date.now() - (2 * 86400000),
        durationDays: 7,
        status: "Active"
      }
    ]
  },
  {
    id: "USR-1002",
    name: "Elena Rostova",
    email: "elena.r@investor.ch",
    password: "password123",
    passwordMasked: "••••••••",
    registeredAt: "2026-09-16 09:12:45",
    walletAddress: "0x39a1fe7c02b98811e9f45d8b8a7321",
    referralCode: "REF-1002-4419",
    referralCount: 1,
    investmentStatus: "pending_approval",
    pendingTxHash: "0x4a9b2c89e1f02c4b81a77e90c5d61",
    totalDeposited: 0.00,
    availableBalance: 0.00,
    totalProfits: 0.00,
    status: "Active",
    activePlans: []
  },
  {
    id: "USR-1003",
    name: "Marcus Chen",
    email: "m.chen@quantfund.sg",
    password: "password123",
    passwordMasked: "••••••••",
    registeredAt: "2026-09-17 18:40:10",
    walletAddress: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
    referralCode: "REF-1003-9934",
    referralCount: 0,
    investmentStatus: "not_invested",
    pendingTxHash: null,
    totalDeposited: 0.00,
    availableBalance: 0.00,
    totalProfits: 0.00,
    status: "Active",
    activePlans: []
  }
];

/**
 * GLOBAL REAL-TIME CLOUD DATABASE ENGINE
 * Enables worldwide synchronization across all browsers, mobile phones, and devices.
 * Uses Firebase Realtime Database (WebSockets) or direct Cloud REST API.
 */
class CloudSyncEngine {
  static dynamicConnected = false;

  static isDynamicServer() {
    return typeof window !== 'undefined' && 
      (window.location.protocol === 'http:' || window.location.protocol === 'https:') &&
      !window.location.hostname.includes('github.io');
  }

  static getCloudUrl() {
    if (this.isDynamicServer()) {
      return window.location.origin + '/api (Dynamic Server)';
    }
    return localStorage.getItem(CLOUD_DB_KEY) || (window.CRYPTRON_CLOUD_CONFIG && window.CRYPTRON_CLOUD_CONFIG.databaseURL) || "";
  }

  static setCloudUrl(url) {
    if (!url) {
      localStorage.removeItem(CLOUD_DB_KEY);
    } else {
      let clean = url.trim();
      if (clean.endsWith('/')) clean = clean.slice(0, -1);
      localStorage.setItem(CLOUD_DB_KEY, clean);
    }
  }

  static isConnected() {
    return this.isDynamicServer() || !!this.getCloudUrl();
  }

  static async pushUsers(users) {
    if (!Array.isArray(users)) return false;

    // 1. Primary: Dynamic Backend Server API (/api/sync)
    if (this.isDynamicServer()) {
      try {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users })
        });
        if (res.ok) {
          this.dynamicConnected = true;
          return true;
        }
      } catch (e) {
        console.warn("Dynamic server pushUsers sync failed, falling back:", e);
      }
    }

    const url = this.getCloudUrl();
    if (!url) return false;

    try {
      // 2. If Firebase SDK initialized
      if (window.firebase && firebase.apps && firebase.apps.length > 0) {
        await firebase.database().ref('cryptron_users').set(users);
        return true;
      }

      // 3. Direct REST API via fetch
      const endpoint = url.includes('.json') ? url : `${url}/cryptron_users.json`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(users)
      });
      return res.ok;
    } catch (e) {
      console.warn("CloudSync push failed:", e);
      return false;
    }
  }

  static async pullUsers() {
    // 1. Primary: Dynamic Backend Server API (/api/users)
    if (this.isDynamicServer()) {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.users) && data.users.length > 0) {
            this.dynamicConnected = true;
            const localRaw = localStorage.getItem(USERS_DB_KEY);
            const localUsers = localRaw ? JSON.parse(localRaw) : [];
            const merged = this.mergeUsers(localUsers, data.users);
            
            const serialized = JSON.stringify(merged);
            localStorage.setItem(USERS_DB_KEY, serialized);
            localStorage.setItem("cryptron_users_db", serialized);
            
            window.dispatchEvent(new StorageEvent('storage', { key: USERS_DB_KEY, newValue: serialized }));
            window.dispatchEvent(new CustomEvent('cryptron_users_updated', { detail: merged }));
            return merged;
          }
        }
      } catch (e) {
        console.warn("Dynamic server pullUsers failed, falling back:", e);
      }
    }

    const url = this.getCloudUrl();
    if (!url) return null;

    try {
      let remoteUsers = null;

      // 2. If Firebase SDK initialized
      if (window.firebase && firebase.apps && firebase.apps.length > 0) {
        const snap = await firebase.database().ref('cryptron_users').once('value');
        remoteUsers = snap.val();
      } else {
        // 3. Direct REST API via fetch
        const endpoint = url.includes('.json') ? url : `${url}/cryptron_users.json`;
        const res = await fetch(endpoint);
        if (res.ok) {
          remoteUsers = await res.json();
        }
      }

      if (remoteUsers && Array.isArray(remoteUsers) && remoteUsers.length > 0) {
        const localRaw = localStorage.getItem(USERS_DB_KEY);
        const localUsers = localRaw ? JSON.parse(localRaw) : [];
        const merged = this.mergeUsers(localUsers, remoteUsers);
        
        // Save merged without triggering infinite sync push
        const serialized = JSON.stringify(merged);
        localStorage.setItem(USERS_DB_KEY, serialized);
        localStorage.setItem("cryptron_users_db", serialized);
        
        window.dispatchEvent(new StorageEvent('storage', { key: USERS_DB_KEY, newValue: serialized }));
        window.dispatchEvent(new CustomEvent('cryptron_users_updated', { detail: merged }));
        return merged;
      }
    } catch (e) {
      console.warn("CloudSync pull failed:", e);
    }
    return null;
  }

  static mergeUsers(localUsers, remoteUsers) {
    if (!Array.isArray(remoteUsers)) return localUsers;
    const map = new Map();
    localUsers.forEach(u => { if (u && u.id) map.set(u.id, u); });
    
    remoteUsers.forEach(ru => {
      if (!ru || !ru.id) return;
      if (!map.has(ru.id)) {
        map.set(ru.id, ru);
      } else {
        const lu = map.get(ru.id);
        if (ru.withdrawalRequest) lu.withdrawalRequest = ru.withdrawalRequest;
        if (ru.pendingTxHash) lu.pendingTxHash = ru.pendingTxHash;
        if (ru.investmentStatus === 'active') {
          lu.investmentStatus = 'active';
          if (ru.activePlans && ru.activePlans.length > 0) lu.activePlans = ru.activePlans;
        }
        if ((ru.referralCount || 0) > (lu.referralCount || 0)) {
          lu.referralCount = ru.referralCount;
        }
        if (ru.referralBypassed) lu.referralBypassed = true;
      }
    });

    return Array.from(map.values());
  }

  static initRealtimeListener(onUpdateCallback) {
    // 1. Dynamic Server Polling
    if (this.isDynamicServer()) {
      this.pullUsers().then(merged => {
        if (merged && onUpdateCallback) onUpdateCallback(merged);
      });
      setInterval(() => {
        CloudSyncEngine.pullUsers().then(merged => {
          if (merged && onUpdateCallback) onUpdateCallback(merged);
        });
      }, 2500);
      return;
    }

    const url = this.getCloudUrl();
    if (!url) return;

    try {
      if (window.firebase && firebase.apps && firebase.apps.length > 0) {
        firebase.database().ref('cryptron_users').on('value', (snap) => {
          const remoteUsers = snap.val();
          if (remoteUsers && Array.isArray(remoteUsers)) {
            const localRaw = localStorage.getItem(USERS_DB_KEY);
            const localUsers = localRaw ? JSON.parse(localRaw) : [];
            const merged = CloudSyncEngine.mergeUsers(localUsers, remoteUsers);
            const serialized = JSON.stringify(merged);
            localStorage.setItem(USERS_DB_KEY, serialized);
            localStorage.setItem("cryptron_users_db", serialized);
            if (onUpdateCallback) onUpdateCallback(merged);
          }
        });
      } else {
        // Poll every 3 seconds for REST
        setInterval(() => {
          CloudSyncEngine.pullUsers().then(merged => {
            if (merged && onUpdateCallback) onUpdateCallback(merged);
          });
        }, 3000);
      }
    } catch(e) {
      console.warn("Realtime listener init error:", e);
    }
  }
}

if (typeof window !== 'undefined') {
  window.CloudSyncEngine = CloudSyncEngine;
}

class UserDatabase {
  /**
   * Retrieve all registered users from database
   * @returns {Array} Array of user objects
   */
  static getAllUsers() {
    let users = null;
    const raw = localStorage.getItem(USERS_DB_KEY) || localStorage.getItem("cryptron_users_db");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          users = parsed;
        }
      } catch (e) {
        console.error("Failed to parse user database:", e);
      }
    }

    if (!users) {
      users = JSON.parse(JSON.stringify(SEED_USERS));
      this.saveUsers(users);
    }

    // Safeguard: reconcile any user found in cryptron_account_v3_countdown
    try {
      const activeAcctRaw = localStorage.getItem("cryptron_account_v3_countdown");
      if (activeAcctRaw) {
        const activeAcct = JSON.parse(activeAcctRaw);
        if (activeAcct && activeAcct.user && activeAcct.user.id && activeAcct.user.email) {
          const exists = users.some(u => u.id === activeAcct.user.id || u.email.toLowerCase() === activeAcct.user.email.toLowerCase());
          if (!exists) {
            users.unshift({
              id: activeAcct.user.id,
              name: activeAcct.user.name || "Client",
              email: activeAcct.user.email,
              password: "password123",
              passwordMasked: "••••••••",
              registeredAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
              walletAddress: activeAcct.user.walletAddress || "0x...",
              referralCode: activeAcct.user.referralCode || `REF-${(activeAcct.user.id||'').replace(/\D/g, '') || '1004'}-7721`,
              referralCount: activeAcct.user.referralCount || 0,
              referralBypassed: !!activeAcct.user.referralBypassed,
              investmentStatus: activeAcct.user.investmentStatus || (activeAcct.activePlans && activeAcct.activePlans.length > 0 ? 'active' : 'not_invested'),
              pendingTxHash: activeAcct.user.pendingTxHash || null,
              withdrawalRequest: activeAcct.user.withdrawalRequest || null,
              totalDeposited: (activeAcct.wallet && activeAcct.wallet.investedBalance) || 0,
              availableBalance: (activeAcct.wallet && activeAcct.wallet.availableBalance) || 0,
              totalProfits: (activeAcct.wallet && activeAcct.wallet.totalProfits) || 0,
              status: "Active",
              activePlans: activeAcct.activePlans || []
            });
            this.saveUsers(users);
          }
        }
      }
    } catch(e) {}

    // Ensure all users have valid unique numeric-based referral codes (no names)
    let updated = false;
    users.forEach(u => {
      const numId = u.id ? u.id.replace(/\D/g, '') : Math.floor(1000 + Math.random() * 9000);
      if (!u.referralCode || !u.referralCode.startsWith("REF-") || /[a-zA-Z]/.test(u.referralCode.replace(/^REF-/, ''))) {
        const rnd = Math.floor(1000 + Math.random() * 9000);
        u.referralCode = `REF-${numId}-${rnd}`;
        updated = true;
      }
      if (u.referralCount === undefined) {
        u.referralCount = 0;
        updated = true;
      }
    });

    if (updated) {
      this.saveUsers(users);
    }

    // Background sync with cloud database if connected
    if (typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.isConnected() && !this._isPullingCloud) {
      this._isPullingCloud = true;
      CloudSyncEngine.pullUsers().finally(() => {
        setTimeout(() => { UserDatabase._isPullingCloud = false; }, 3000);
      });
    }

    return users;
  }

  /**
   * Save all users back to localStorage and Cloud Database
   */
  static saveUsers(users) {
    const serialized = JSON.stringify(users);
    localStorage.setItem(USERS_DB_KEY, serialized);
    localStorage.setItem("cryptron_users_db", serialized);
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        if (typeof StorageEvent !== 'undefined') {
          window.dispatchEvent(new StorageEvent('storage', {
            key: USERS_DB_KEY,
            newValue: serialized
          }));
        }
        if (typeof CustomEvent !== 'undefined') {
          window.dispatchEvent(new CustomEvent('cryptron_users_updated', { detail: users }));
        }
      }
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('cryptron_bus');
        bc.postMessage({ type: 'USERS_UPDATED', users: users });
        bc.close();
      }

      // Synchronize globally with Cloud Database (across any device or browser worldwide)
      if (typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.isConnected()) {
        CloudSyncEngine.pushUsers(users);
      }
    } catch (e) {}
  }

  /**
   * Get a single user by User ID
   */
  static getUserById(id) {
    if (!id) return null;
    const users = this.getAllUsers();
    return users.find(u => u.id === id) || null;
  }

  /**
   * Get a single user by Email
   */
  static getUserByEmail(email) {
    if (!email) return null;
    const users = this.getAllUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
  }

  /**
   * Get current active user session
   */
  static getCurrentUserId() {
    return localStorage.getItem(CURRENT_USER_KEY) || null;
  }

  /**
   * Set current active user session
   */
  static setCurrentUserId(userId) {
    if (!userId) {
      localStorage.removeItem(CURRENT_USER_KEY);
    } else {
      localStorage.setItem(CURRENT_USER_KEY, userId);
    }
  }

  /**
   * Log out active user session
   */
  static logout() {
    localStorage.removeItem(CURRENT_USER_KEY);
  }

  /**
   * Credit a referral count to the user matching the given referral code
   * @param {string} refCode - e.g. "REF-1001-8821" or "REF-1004-7492"
   */
  static creditReferral(refCode) {
    if (!refCode) return null;
    const users = this.getAllUsers();
    const clean = refCode.trim().toLowerCase();

    // Match by exact referral code or by embedded numeric ID
    let referrer = users.find(u => u.referralCode && u.referralCode.toLowerCase() === clean);
    if (!referrer) {
      const parts = clean.split('-');
      if (parts.length >= 2) {
        const candidateId = "usr-" + parts[1];
        referrer = users.find(u => u.id && u.id.toLowerCase() === candidateId);
      }
    }

    if (referrer) {
      referrer.referralCount = (referrer.referralCount || 0) + 1;
      this.saveUsers(users);

      // Synchronize in-session account if referrer is logged in
      try {
        const stored = localStorage.getItem("cryptron_account_v3_countdown");
        if (stored) {
          const acc = JSON.parse(stored);
          if (acc.user && acc.user.id === referrer.id) {
            acc.user.referralCount = referrer.referralCount;
            localStorage.setItem("cryptron_account_v3_countdown", JSON.stringify(acc));
          }
        }
      } catch (e) {}

      return referrer;
    }
    return null;
  }

  /**
   * Register a new user into the database
   */
  static registerUser(name, email, password, referredByCode = null) {
    const users = this.getAllUsers();
    
    // Check if email already exists
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (existing) {
      throw new Error("An account with this email address already exists.");
    }

    const nextNumber = 1000 + users.length + 1;
    const newId = "USR-" + nextNumber;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    // Unique ID-based referral code: strictly numbers and ID, NO client name
    const refCode = `REF-${nextNumber}-${randomSuffix}`;
    const mockWallet = "0x" + Math.random().toString(16).substring(2, 10) + "..." + Math.random().toString(16).substring(2, 6);
    
    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);
    const cleanReferredBy = referredByCode ? referredByCode.trim().toUpperCase() : null;

    const newUser = {
      id: newId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password || "password123",
      passwordMasked: "••••••••",
      registeredAt: dateStr,
      walletAddress: mockWallet,
      referralCode: refCode,
      referralCount: 0,
      referredBy: cleanReferredBy,
      referralSpinCredited: false, // Set to true once this referral deposits $10 and spins the wheel
      investmentStatus: "not_invested", // Starts with no investment until approved
      pendingTxHash: null,
      totalDeposited: 0.00,
      availableBalance: 0.00,
      totalProfits: 0.00,
      status: "Active",
      activePlans: []
    };

    users.unshift(newUser);
    this.saveUsers(users);

    // Set as active session
    this.setCurrentUserId(newUser.id);

    return newUser;
  }

  /**
   * Record that a user has spun the wheel and credit their inviter if this is their first spin
   * (Rule: Referrals must sign up, deposit $10, and spin the wheel for the inviter to receive credit)
   */
  static recordUserSpin(userId) {
    if (!userId) return null;
    const users = this.getAllUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return null;

    user.lastSpinTimestamp = Date.now();

    // If this user was referred by someone and hasn't yet credited them for spinning
    if (user.referredBy && !user.referralSpinCredited) {
      user.referralSpinCredited = true;
      const clean = user.referredBy.trim().toUpperCase();

      // Find referrer by referral code or user id
      let referrer = users.find(u => u.referralCode && u.referralCode.toUpperCase() === clean);
      if (!referrer) {
        const parts = clean.split('-');
        if (parts.length >= 2) {
          const candidateId = "usr-" + parts[1].toLowerCase();
          referrer = users.find(u => u.id && u.id.toLowerCase() === candidateId);
        }
      }

      if (referrer) {
        referrer.referralCount = (referrer.referralCount || 0) + 1;
        
        // Sync active account in localStorage if referrer is in session
        try {
          const stored = localStorage.getItem("cryptron_account_v3_countdown");
          if (stored) {
            const acc = JSON.parse(stored);
            if (acc.user && acc.user.id === referrer.id) {
              acc.user.referralCount = referrer.referralCount;
              localStorage.setItem("cryptron_account_v3_countdown", JSON.stringify(acc));
            }
          }
        } catch(e) {}
      }
    }

    this.saveUsers(users);
    return user;
  }

  /**
   * Get list of users referred by a specific referral code or user ID
   */
  static getReferralsForUser(refCodeOrId) {
    if (!refCodeOrId) return [];
    const users = this.getAllUsers();
    const clean = refCodeOrId.trim().toUpperCase();
    return users.filter(u => {
      if (!u.referredBy) return false;
      const refBy = u.referredBy.trim().toUpperCase();
      if (refBy === clean) return true;
      const parts = clean.split('-');
      if (parts.length >= 2) {
        return refBy === ("REF-" + parts[1]) || refBy.includes(parts[1]);
      }
      return false;
    });
  }

  /**
   * Authenticate / Login user
   */
  static loginUser(email, password) {
    const user = this.getUserByEmail(email);
    if (!user) {
      throw new Error("No account found with this email. Please register first.");
    }
    // Verify password if provided and user has a password configured
    if (user.password && password && !password.includes("••••")) {
      if (user.password !== password) {
        throw new Error("Incorrect password. Please verify your credentials or click 'Forgot?' to reset it.");
      }
    }
    this.setCurrentUserId(user.id);
    return user;
  }

  /**
   * Request a 6-digit verification code to reset password
   * @param {string} email - Registered email
   */
  static requestPasswordReset(email) {
    const user = this.getUserByEmail(email);
    if (!user) {
      throw new Error("No account registered with this email address. Please check your spelling or sign up.");
    }

    // Generate random 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetCode = resetCode;
    user.resetCodeExpires = Date.now() + (15 * 60 * 1000); // 15 mins

    const users = this.getAllUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      users[idx] = user;
      this.saveUsers(users);
    }

    // Dispatch email notification via EmailService
    if (window.EmailService) {
      EmailService.sendPasswordResetEmail(user, resetCode);
    }

    return { user, resetCode };
  }

  /**
   * Complete password reset using verification code
   * @param {string} email - User email
   * @param {string} code - 6-digit code received
   * @param {string} newPassword - New password chosen by user
   */
  static resetPasswordWithCode(email, code, newPassword) {
    const user = this.getUserByEmail(email);
    if (!user) {
      throw new Error("User account not found.");
    }

    if (!user.resetCode || user.resetCode !== code.trim()) {
      throw new Error("Invalid 6-digit verification code. Please check your email or request a new code.");
    }

    if (user.resetCodeExpires && Date.now() > user.resetCodeExpires) {
      throw new Error("This verification code has expired. Please request a new code.");
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }

    user.password = newPassword;
    user.resetCode = null;
    user.resetCodeExpires = null;

    const users = this.getAllUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      users[idx] = user;
      this.saveUsers(users);
    }

    if (window.EmailService) {
      EmailService.sendPasswordChangedEmail(user);
    }

    this.setCurrentUserId(user.id);
    return user;
  }

  /**
   * ADMIN ACTION: Direct Password Reset from Admin Portal
   */
  static adminResetPassword(userId, newPassword) {
    const users = this.getAllUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error("User not found.");

    if (!newPassword || newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters.");
    }

    user.password = newPassword;
    user.resetCode = null;
    user.resetCodeExpires = null;

    this.saveUsers(users);

    if (window.EmailService) {
      EmailService.sendPasswordChangedEmail(user);
    }

    return user;
  }

  /**
   * ADMIN ACTION: Enable / Activate $10 Investment & Start 7-Day Countdown Timer
   * @param {string} userId - ID of user to activate (e.g. "USR-1002")
   * @returns {object} Updated user record
   */
  static activateUserInvestment(userId) {
    const users = this.getAllUsers();
    const user = users.find(u => u.id === userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found.`);
    }

    const now = Date.now();
    const durationDays = 7;
    // Exactly 7 days from right now (7 * 24 * 60 * 60 * 1000 ms)
    const maturityTimestamp = now + (durationDays * 86400000);

    const newPlan = {
      id: "cryp-" + Math.floor(700 + Math.random() * 200),
      planName: "7-Day Crypto Yield Vault",
      principal: 10.00,
      totalPayout: 25.00,
      createdAt: now,
      maturityTimestamp: maturityTimestamp,
      durationDays: durationDays,
      status: "Active",
      activatedAt: new Date(now).toISOString().replace('T', ' ').substring(0, 19)
    };

    user.activePlans = user.activePlans || [];
    user.activePlans.unshift(newPlan);
    user.investmentStatus = "active";
    user.totalDeposited = (user.totalDeposited || 0) + 10.00;
    user.pendingTxHash = null; // Clear pending flag

    this.saveUsers(users);

    // Sync session storage if active user
    if (this.getCurrentUserId() === userId || userId === "USR-1001") {
      try {
        const stored = localStorage.getItem("cryptron_account_v3_countdown");
        let acc = stored ? JSON.parse(stored) : {};
        if (!acc.wallet) acc.wallet = {};
        if (!acc.user) acc.user = {};
        acc.activePlans = user.activePlans;
        acc.user.hasActiveInvestment = true;
        acc.user.investmentStatus = "active";
        acc.user.pendingTxHash = null;
        acc.wallet.investedBalance = (acc.wallet.investedBalance || 0) + 10.00;
        localStorage.setItem("cryptron_account_v3_countdown", JSON.stringify(acc));
      } catch (e) {}
    }

    // Dispatch protocol message to client
    try {
      this.sendMessage({
        targetType: "individual",
        targetUserId: userId,
        targetUserName: user.name,
        subject: "⚡ $10 Deposit Confirmed - 7-Day Timer Started!",
        body: `Hello ${user.name}, your $10.00 USDT deposit has been confirmed and approved by the protocol administrator. Your 7-day maturity countdown timer is now running live toward your $25.00 payout!`,
        priority: "success",
        category: "Deposit Approved"
      });
    } catch(e) {}

    return user;
  }

  /**
   * ADMIN ACTION: Reset / Cancel User Investment
   */
  static deactivateUserInvestment(userId) {
    const users = this.getAllUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error("User not found");

    user.activePlans = [];
    user.investmentStatus = "not_invested";
    user.pendingTxHash = null;

    this.saveUsers(users);

    return user;
  }

  /**
   * CLIENT ACTION: Submit Payment Confirmation / Transaction Hash
   * Puts account into 'pending_approval' so admin can review and start timer.
   */
  static submitDepositConfirmation(userId, txHash) {
    const users = this.getAllUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error("User not found");

    user.investmentStatus = "pending_approval";
    user.pendingTxHash = txHash.trim();
    user.depositSubmittedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

    this.saveUsers(users);

    return user;
  }

  /**
   * ADMIN ACTION: Delete a user permanently from the database
   * @param {string} userId - ID of user to delete
   */
  static deleteUser(userId) {
    let users = this.getAllUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      throw new Error(`User with ID ${userId} not found.`);
    }

    const deletedUser = users[userIndex];
    users.splice(userIndex, 1);
    this.saveUsers(users);

    // If deleted user was active session, switch to next available user or clear
    if (this.getCurrentUserId() === userId) {
      if (users.length > 0) {
        this.setCurrentUserId(users[0].id);
      } else {
        localStorage.removeItem(CURRENT_USER_KEY);
      }
    }

    return deletedUser;
  }

  /**
   * Export all users to a CSV file (Excel compatible)
   */
  static exportUsersCSV() {
    const users = this.getAllUsers();
    let csv = "User ID,Full Name,Email Address,Registered Date,Wallet Address,Referral Code,Investment Status,Active Contracts,Total Deposited,Submitted Tx Hash,Status\n";
    
    users.forEach(u => {
      const activeCount = (u.activePlans || []).length;
      csv += `"${u.id}","${u.name}","${u.email}","${u.registeredAt}","${u.walletAddress}","${u.referralCode}","${u.investmentStatus}","${activeCount}","$${u.totalDeposited || 0}","${u.pendingTxHash || 'N/A'}","${u.status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `CRYPTRON_Users_Database_${new Date().toISOString().substring(0,10)}.csv`);
    a.click();
  }

  /**
   * ADMIN ACTION: Instantly mature an investment contract (Fast-forward countdown to 0)
   * Unlocks the $25.00 payout immediately for client withdrawal.
   * @param {string} userId - ID of user whose contract to mature
   */
  static matureUserInvestment(userId) {
    const users = this.getAllUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error(`User ${userId} not found.`);

    if (!user.activePlans || user.activePlans.length === 0) {
      throw new Error("This client currently has no active investment contracts to mature.");
    }

    const now = Date.now();
    let totalYieldAdded = 0;

    user.activePlans.forEach(plan => {
      // Set maturity timestamp to past so real-time countdown becomes 0 / Expired
      plan.maturityTimestamp = now - 5000;
      plan.status = "Matured";
      plan.isMatured = true;
      totalYieldAdded += (plan.totalPayout || 25.00);
    });

    // Strictly $25.00 payout available to client upon maturity
    user.availableBalance = 25.00;
    user.totalProfits = 25.00;
    user.investmentStatus = "matured";

    this.saveUsers(users);

    // Dispatch congratulatory maturity notification message to the client
    try {
      this.sendMessage({
        targetType: "individual",
        targetUserId: userId,
        targetUserName: user.name,
        subject: "🎉 Contract Matured - $25.00 Ready for Withdrawal!",
        body: `Congratulations ${user.name}! Your 7-day crypto yield vault investment has completed its term. Your guaranteed $25.00 USDT payout is now unlocked and available in your balance. Please click the 'Withdraw' button and paste your personal USDT Tether wallet address to receive your payment.`,
        priority: "success",
        category: "Maturity Settlement"
      });
    } catch(e) {}

    // If this is currently the active session user, immediately sync local storage
    if (this.getCurrentUserId() === userId || userId === "USR-1001") {
      try {
        const stored = localStorage.getItem("cryptron_account_v3_countdown");
        let acc = stored ? JSON.parse(stored) : {};
        if (!acc.wallet) acc.wallet = {};
        if (!acc.user) acc.user = {};
        acc.activePlans = user.activePlans;
        acc.wallet.availableBalance = 25.00;
        acc.wallet.totalProfits = 25.00;
        acc.user.hasActiveInvestment = true;
        acc.user.investmentStatus = "matured";
        localStorage.setItem("cryptron_account_v3_countdown", JSON.stringify(acc));
      } catch (e) {
        console.warn("Could not sync active session state", e);
      }
    }

    return user;
  }

  /**
   * CLIENT ACTION: Submit withdrawal request with destination USDT Tether address
   * @param {string} userId - User ID
   * @param {number} amount - Amount in USD
   * @param {string} usdtAddress - Destination USDT address pasted by user
   * @param {string} network - USDT network (e.g. USDT TRC-20, ERC-20, BEP-20)
   */
  static submitWithdrawalRequest(userId, amount, usdtAddress, network = "USDT (Tether)") {
    const users = this.getAllUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error(`User ${userId} not found.`);

    // MANDATORY RULE 1: Maximum withdrawal amount is $25.00 USDT
    const parsedAmount = parseFloat(amount) || 25.00;
    if (parsedAmount > 25.00) {
      throw new Error("Maximum withdrawal amount is $25.00 USDT per request.");
    }

    // MANDATORY RULE 2: Must have invited at least 5 friends who spun the wheel (unless waived by Admin)
    const isBypassed = !!user.referralBypassed;
    const invited = (user.referralCount !== undefined) ? user.referralCount : 0;
    if (!isBypassed && invited < 5) {
      throw new Error(`🔒 Withdrawal Locked: You must have brought at least 5 friends who spun the wheel before you can withdraw (${invited}/5 completed).`);
    }

    if (!usdtAddress || usdtAddress.trim().length < 6) {
      throw new Error("Please paste a valid USDT (Tether) receiving address.");
    }

    const reqId = "WREQ-" + Math.floor(10000 + Math.random() * 90000);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    user.withdrawalRequest = {
      id: reqId,
      amount: parsedAmount,
      usdtAddress: usdtAddress.trim(),
      network: network,
      status: "Pending Settlement",
      submittedAt: now
    };

    // RULE: After withdrawal, everything starts afresh!
    // Active 7-day contract is completed & archived; client must deposit $10 to start a new cycle and spin the wheel
    user.completedPlans = user.completedPlans || [];
    if (user.activePlans && user.activePlans.length > 0) {
      user.completedPlans.unshift(...user.activePlans);
    }
    user.activePlans = [];
    user.hasActiveInvestment = false;
    user.investmentStatus = "not_invested"; // Fresh state: requires new $10 deposit
    user.availableBalance = 0.00;
    user.totalProfits = (user.totalProfits || 0) + parsedAmount;
    user.pendingWithdrawal = (user.pendingWithdrawal || 0) + parsedAmount;
    user.referralCount = 0; // Starts afresh for the next cycle
    user.referralBypassed = false;

    this.saveUsers(users);

    // Sync active session if this is the active user
    if (this.getCurrentUserId() === userId || userId === "USR-1001") {
      try {
        const stored = localStorage.getItem("cryptron_account_v3_countdown");
        if (stored) {
          const acc = JSON.parse(stored);
          acc.user.withdrawalRequest = user.withdrawalRequest;
          acc.user.hasActiveInvestment = false;
          acc.user.investmentStatus = "not_invested";
          acc.activePlans = [];
          acc.wallet.availableBalance = 0.00;
          acc.wallet.investedBalance = 0.00;
          acc.wallet.pendingWithdrawal = user.pendingWithdrawal;
          acc.user.referralCount = 0;
          acc.user.referralBypassed = false;
          localStorage.setItem("cryptron_account_v3_countdown", JSON.stringify(acc));
        }
      } catch (e) {}
    }

    return user.withdrawalRequest;
  }

  /**
   * ADMIN ACTION: Confirm and settle a client's pending withdrawal request
   * @param {string} userId - User ID
   * @param {string} txHash - On-chain settlement transaction hash
   */
  static settleWithdrawalRequest(userId, txHash) {
    const users = this.getAllUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error(`User ${userId} not found.`);

    if (!user.withdrawalRequest) {
      throw new Error("No pending withdrawal request found for this client.");
    }

    const hash = txHash || ("0x" + Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 10));
    const settledReq = {
      ...user.withdrawalRequest,
      status: "Settled",
      settledAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      settlementTxHash: hash
    };

    user.withdrawalHistory = user.withdrawalHistory || [];
    user.withdrawalHistory.unshift(settledReq);
    user.pendingWithdrawal = Math.max(0, (user.pendingWithdrawal || 0) - user.withdrawalRequest.amount);
    user.withdrawalRequest = null;

    // Dispatch congratulatory settlement notice to client inbox
    user.notifications = user.notifications || [];
    user.notifications.unshift({
      id: "NOTIF-" + Date.now(),
      title: "✅ USDT Payout Settled & Dispatched",
      message: `Your requested payout of $${settledReq.amount.toFixed(2)} USDT has been successfully dispatched to your USDT Tether receiving address: ${settledReq.usdtAddress}. Transaction Hash: ${hash}. Deposit $10.00 USDT now to start a new 7-day vault!`,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      read: false,
      priority: "success"
    });

    this.saveUsers(users);

    if (this.getCurrentUserId() === userId || userId === "USR-1001") {
      try {
        const stored = localStorage.getItem("cryptron_account_v3_countdown");
        if (stored) {
          const acc = JSON.parse(stored);
          acc.user.withdrawalRequest = null;
          acc.wallet.pendingWithdrawal = user.pendingWithdrawal;
          localStorage.setItem("cryptron_account_v3_countdown", JSON.stringify(acc));
        }
      } catch (e) {}
    }

    return settledReq;
  }

  /**
   * ADMIN ACTION: Toggle referral requirement waiver for a specific client
   * @param {string} userId - ID of user
   * @returns {object} Updated user record
   */
  static toggleUserReferralBypass(userId) {
    const users = this.getAllUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error(`User ${userId} not found.`);

    user.referralBypassed = !user.referralBypassed;
    this.saveUsers(users);

    // If active session, sync localStorage
    if (this.getCurrentUserId() === userId || userId === "USR-1001") {
      try {
        const stored = localStorage.getItem("cryptron_account_v3_countdown");
        if (stored) {
          const acc = JSON.parse(stored);
          if (!acc.user) acc.user = {};
          acc.user.referralBypassed = user.referralBypassed;
          localStorage.setItem("cryptron_account_v3_countdown", JSON.stringify(acc));
        }
      } catch (e) {}
    }

    // If newly waived, notify the client
    if (user.referralBypassed) {
      try {
        this.sendMessage({
          targetType: "individual",
          targetUserId: userId,
          targetUserName: user.name,
          subject: "🎉 Referral Requirement Waived - Withdrawals Unlocked!",
          body: `Hello ${user.name}, the protocol administrator has granted you an exemption from the 5-referral wheel spin requirement. You are now fully eligible to submit your $25.00 USDT withdrawal!`,
          priority: "success",
          category: "Account Privilege"
        });
      } catch(e) {}
    }

    return user;
  }

  /**
   * ==================== PROTOCOL MESSAGING SYSTEM ====================
   * Handles individual, group broadcasts (All Active, All Non-Active, Withdrawal Requested)
   */
  static getAllMessages() {
    const raw = localStorage.getItem("cryptron_broadcast_messages");
    if (!raw) {
      const initialMessages = [
        {
          id: "MSG-1001",
          sender: "CRYPTRON Protocol Admin",
          targetType: "all_active",
          targetUserId: null,
          targetUserName: null,
          subject: "7-Day Vault Security & Payout Guarantee",
          body: "Your 7-day staking contract is protected by multi-sig vaults. Once your maturity countdown timer reaches zero, paste your USDT (Tether) receiving address to collect your $25.00 guaranteed yield.",
          priority: "info",
          category: "Staking Guarantee",
          createdAt: "2026-09-17 10:00:00",
          readBy: []
        },
        {
          id: "MSG-1002",
          sender: "CRYPTRON Protocol Admin",
          targetType: "all_inactive",
          targetUserId: null,
          targetUserName: null,
          subject: "Welcome to CRYPTRON - Activate Your $10 Contract",
          body: "Welcome to CRYPTRON Protocol! Complete your initial $10.00 USDT deposit to activate your 7-day countdown to $25.00 and unlock your daily spin on the $10,000 Lucky Wheel.",
          priority: "info",
          category: "Getting Started",
          createdAt: "2026-09-17 10:30:00",
          readBy: []
        }
      ];
      localStorage.setItem("cryptron_broadcast_messages", JSON.stringify(initialMessages));
      return initialMessages;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  static saveMessages(messages) {
    localStorage.setItem("cryptron_broadcast_messages", JSON.stringify(messages));
  }

  /**
   * ADMIN ACTION: Send / Drop a message to an individual or segmented audience
   */
  static sendMessage({ targetType, targetUserId, targetUserName, subject, body, priority = "info", category = "Protocol Notice" }) {
    if (!subject || !subject.trim()) throw new Error("Please provide a message subject.");
    if (!body || !body.trim()) throw new Error("Please enter message body content.");

    const messages = this.getAllMessages();
    const newMsg = {
      id: "MSG-" + Date.now(),
      sender: "CRYPTRON Protocol Admin",
      targetType: targetType || "all_active", // "individual" | "all_active" | "all_inactive" | "withdrawal_requested" | "all"
      targetUserId: targetUserId || null,
      targetUserName: targetUserName || null,
      subject: subject.trim(),
      body: body.trim(),
      priority: priority, // "info" | "urgent" | "success" | "warning"
      category: category,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      readBy: []
    };

    messages.unshift(newMsg);
    this.saveMessages(messages);
    return newMsg;
  }

  /**
   * Get all messages relevant to a specific user based on their segment & user ID
   */
  static getMessagesForUser(userId) {
    const user = this.getUserById(userId);
    const messages = this.getAllMessages();
    if (!user) return [];

    const hasActivePlans = (user.activePlans && user.activePlans.length > 0) || user.investmentStatus === 'active' || user.investmentStatus === 'matured';
    const hasWithdrawalReq = !!user.withdrawalRequest;
    const isInactive = !hasActivePlans && user.investmentStatus !== 'pending_approval';

    return messages.filter(msg => {
      if (msg.targetType === 'all') return true;
      if (msg.targetType === 'individual' && msg.targetUserId === userId) return true;
      if (msg.targetType === 'all_active' && hasActivePlans) return true;
      if (msg.targetType === 'all_inactive' && isInactive) return true;
      if (msg.targetType === 'withdrawal_requested' && hasWithdrawalReq) return true;
      return false;
    }).map(msg => ({
      ...msg,
      isRead: msg.readBy && msg.readBy.includes(userId)
    }));
  }

  /**
   * Mark a message as read by a client
   */
  static markMessageRead(messageId, userId) {
    const messages = this.getAllMessages();
    const msg = messages.find(m => m.id === messageId);
    if (msg) {
      msg.readBy = msg.readBy || [];
      if (!msg.readBy.includes(userId)) {
        msg.readBy.push(userId);
        this.saveMessages(messages);
      }
    }
  }

  /**
   * ADMIN ACTION: Delete a dispatched message
   */
  static deleteMessage(messageId) {
    let messages = this.getAllMessages();
    messages = messages.filter(m => m.id !== messageId);
    this.saveMessages(messages);
    return true;
  }
}

window.UserDatabase = UserDatabase;

