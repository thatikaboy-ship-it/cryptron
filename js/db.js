/**
 * CRYPTRONVEST - USER DATABASE ENGINE
 * Handles user registration, credentials storage, manual investment activations,
 * 7-day countdown timers, and admin user directories.
 */

const USERS_DB_KEY = "cryptron_registered_users_v2";
const CURRENT_USER_KEY = "cryptron_current_user_id";
const CLOUD_DB_KEY = "cryptron_cloud_database_url";
const DELETED_USERS_KEY = "cryptron_deleted_users_v1";
const DB_INITIALIZED_KEY = "cryptron_db_initialized_v1";

// Initial seed database with sample registered users showcasing all 3 states:
// 1. USR-1001: Active 7-day timer running
// 2. USR-1002: Pending Admin Approval ($10 deposit submitted)
// 3. USR-1003: No Investment (New Signup awaiting action)
const SEED_USERS = [
  {
    id: "USR-1001",
    name: "David Miller",
    email: "d.miller@cryptronvest.com",
    password: "password123",
    passwordMasked: "••••••••",
    registeredAt: "2026-09-12 14:30:22",
    walletAddress: "0x71C839e248bF2190827fA38aB15aF7",
    promoCode: "DAVID8821",
    referralCode: "DAVID8821",
    referralCount: 3,
    investmentStatus: "active", // 'active', 'pending_approval', 'not_invested'
    pendingTxHash: null,
    lastSpinTimestamp: 0,
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
    promoCode: "ELENA4419",
    referralCode: "ELENA4419",
    referralCount: 1,
    investmentStatus: "pending_approval",
    pendingTxHash: "0x4a9b2c89e1f02c4b81a77e90c5d61",
    lastSpinTimestamp: 0,
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
    promoCode: "MARCUS9934",
    referralCode: "MARCUS9934",
    referralCount: 0,
    investmentStatus: "not_invested",
    pendingTxHash: null,
    lastSpinTimestamp: 0,
    totalDeposited: 0.00,
    availableBalance: 0.00,
    totalProfits: 0.00,
    status: "Active",
    activePlans: []
  }
];

// GLOBAL CLOUD DATABASE CONFIGURATION
// To connect all devices, phones, and browsers worldwide in real-time,
// enter your Firebase Realtime Database URL here (e.g. "https://your-project-default-rtdb.firebaseio.com")
const GLOBAL_CLOUD_DB_URL = "https://cryptron-a4523-default-rtdb.firebaseio.com";

/**
 * GLOBAL REAL-TIME CLOUD DATABASE ENGINE
 * Enables worldwide synchronization across all browsers, mobile phones, and devices.
 * Uses Firebase Realtime Database (WebSockets) or direct Cloud REST API.
 */
class CloudSyncEngine {
  static _isDeleting = false;
  static _deleteEpoch = 0;

  static sanitizeFirebaseKey(str) {
    return String(str || '').toLowerCase().trim().replace(/[.#$\[\]\/]/g, '_');
  }

  static getCloudUrl() {
    return localStorage.getItem(CLOUD_DB_KEY) || 
           (window.CRYPTRON_CLOUD_CONFIG && window.CRYPTRON_CLOUD_CONFIG.databaseURL) || 
           GLOBAL_CLOUD_DB_URL || 
           "";
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
    return !!this.getCloudUrl();
  }

  /**
   * Initialize Firebase SDK if loaded and URL is present
   */
  static initFirebase() {
    const url = this.getCloudUrl();
    if (!url || typeof window === 'undefined' || !window.firebase) return false;
    try {
      if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp({ databaseURL: url });
      }
      return true;
    } catch (e) {
      console.warn("Firebase init error:", e);
      return false;
    }
  }

  /**
   * Push a single user record to the cloud database (atomic update, never overwrites other clients)
   * @param {object} user - User object
   */
  static async pushUser(user) {
    if (!user || !user.id) return false;
    if (typeof UserDatabase !== 'undefined' && UserDatabase.isUserDeleted(user.id, user.email)) {
      return false;
    }
    const url = this.getCloudUrl();
    if (!url) return false;
    this.initFirebase();

    const cleanUser = { ...user };
    delete cleanUser._fbKey;

    try {
      // 1. If Firebase SDK initialized
      if (window.firebase && firebase.apps && firebase.apps.length > 0) {
        await firebase.database().ref(`cryptron_users/${cleanUser.id}`).set(cleanUser);
        return true;
      }

      // 2. Direct REST API via fetch PUT/PATCH for this specific user
      const cleanBase = url.replace(/\/$/, '').replace(/\/cryptron_users\.json$/, '').replace(/\.json$/, '');
      const endpoint = `${cleanBase}/cryptron_users/${cleanUser.id}.json`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanUser)
      });
      return res.ok;
    } catch (e) {
      console.warn("CloudSync pushUser failed:", e);
      return false;
    }
  }

  /**
   * Push an array of users using non-destructive PATCH
   * @param {Array} users 
   */
  static async pushUsers(users) {
    if (this._isDeleting) return false;
    const url = this.getCloudUrl();
    if (!url || !Array.isArray(users)) return false;
    this.initFirebase();

    try {
      const updateObj = {};
      users.forEach(u => {
        if (!u || !u.id) return;
        if (typeof UserDatabase !== 'undefined' && UserDatabase.isUserDeleted(u.id, u.email)) return;
        const cleanU = { ...u };
        delete cleanU._fbKey;
        updateObj[cleanU.id] = cleanU;
      });

      if (Object.keys(updateObj).length === 0) return true;

      // 1. If Firebase SDK initialized
      if (window.firebase && firebase.apps && firebase.apps.length > 0) {
        await firebase.database().ref('cryptron_users').update(updateObj);
        return true;
      }

      // 2. Direct REST API via fetch PATCH
      const cleanBase = url.replace(/\/$/, '').replace(/\.json$/, '');
      const endpoint = cleanBase.endsWith('/cryptron_users') ? `${cleanBase}.json` : `${cleanBase}/cryptron_users.json`;
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateObj)
      });
      return res.ok;
    } catch (e) {
      console.warn("CloudSync pushUsers failed:", e);
      return false;
    }
  }

  /**
   * Push deleted user tombstones (IDs & emails) to Firebase so no device ever resurrects them
   */
  static async pushDeletedTombstones(ids = [], emails = []) {
    const url = this.getCloudUrl();
    if (!url) return false;
    this.initFirebase();

    const cleanBase = url.replace(/\/$/, '').replace(/\/cryptron_users\.json$/, '').replace(/\.json$/, '');
    const now = Date.now();
    const idMap = {};
    const emailMap = {};

    (ids || []).forEach(id => {
      if (!id) return;
      const safeId = String(id).trim().replace(/[.#$\[\]\/]/g, '_');
      if (safeId) idMap[safeId] = now;
    });

    (emails || []).forEach(em => {
      if (!em) return;
      const rawEmail = String(em).toLowerCase().trim();
      const safeKey = this.sanitizeFirebaseKey(rawEmail);
      if (safeKey) emailMap[safeKey] = rawEmail;
    });

    try {
      const promises = [];
      if (Object.keys(idMap).length > 0) {
        if (window.firebase && firebase.apps && firebase.apps.length > 0) {
          promises.push(firebase.database().ref('cryptron_deleted_users/ids').update(idMap).catch(() => {}));
        }
        promises.push(fetch(`${cleanBase}/cryptron_deleted_users/ids.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(idMap)
        }).catch(() => {}));
      }
      if (Object.keys(emailMap).length > 0) {
        if (window.firebase && firebase.apps && firebase.apps.length > 0) {
          promises.push(firebase.database().ref('cryptron_deleted_users/emails').update(emailMap).catch(() => {}));
        }
        promises.push(fetch(`${cleanBase}/cryptron_deleted_users/emails.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailMap)
        }).catch(() => {}));
      }
      await Promise.all(promises);
      return true;
    } catch (e) {
      console.warn("pushDeletedTombstones warning:", e);
      return false;
    }
  }

  /**
   * Remove a tombstone when a user explicitly registers afresh with a previously deleted email
   */
  static async removeDeletedTombstone(id, email) {
    const url = this.getCloudUrl();
    if (!url) return false;
    this.initFirebase();
    const cleanBase = url.replace(/\/$/, '').replace(/\/cryptron_users\.json$/, '').replace(/\.json$/, '');

    try {
      const promises = [];
      if (id) {
        const safeId = String(id).trim().replace(/[.#$\[\]\/]/g, '_');
        if (window.firebase && firebase.apps && firebase.apps.length > 0) {
          promises.push(firebase.database().ref(`cryptron_deleted_users/ids/${safeId}`).remove().catch(() => {}));
        }
        promises.push(fetch(`${cleanBase}/cryptron_deleted_users/ids/${safeId}.json`, { method: 'DELETE' }).catch(() => {}));
      }
      if (email) {
        const safeKey = this.sanitizeFirebaseKey(email);
        if (window.firebase && firebase.apps && firebase.apps.length > 0) {
          promises.push(firebase.database().ref(`cryptron_deleted_users/emails/${safeKey}`).remove().catch(() => {}));
        }
        promises.push(fetch(`${cleanBase}/cryptron_deleted_users/emails/${safeKey}.json`, { method: 'DELETE' }).catch(() => {}));
      }
      await Promise.all(promises);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Permanently delete a user from the cloud database (Firebase SDK & REST)
   * @param {string} userId - ID of user to delete
   * @param {string} userEmail - Optional email of user to delete
   */
  static async deleteUser(userId, userEmail = null) {
    if (!userId && !userEmail) return false;
    return this.deleteUsers(userId ? [userId] : [], userEmail ? [userEmail] : []);
  }

  /**
   * Bulk delete multiple users from cloud database permanently (including any duplicate/re-indexed keys)
   * @param {Array<string>} userIds
   * @param {Array<string>} userEmails
   */
  static async deleteUsers(userIds = [], userEmails = []) {
    const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
    const emails = Array.isArray(userEmails) ? userEmails.filter(Boolean).map(e => String(e).toLowerCase().trim()) : [];
    if (ids.length === 0 && emails.length === 0) return false;

    const url = this.getCloudUrl();
    if (!url) return false;
    this.initFirebase();

    this._isDeleting = true;
    this._deleteEpoch = (this._deleteEpoch || 0) + 1;

    try {
      const cleanBase = url.replace(/\/$/, '').replace(/\/cryptron_users\.json$/, '').replace(/\.json$/, '');
      const idSet = new Set(ids.map(i => String(i).trim()));
      const emailSet = new Set(emails);

      // 1. Record tombstones in localStorage & Firebase first so no concurrent poll can resurrect them
      if (typeof UserDatabase !== 'undefined' && UserDatabase.markUsersDeleted) {
        UserDatabase.markUsersDeleted(ids, emails);
      }
      await this.pushDeletedTombstones(ids, emails);

      // 2. Discover all Firebase keys under cryptron_users matching any target ID or Email
      // (This catches any duplicate or re-indexed keys created in earlier sessions)
      const keysToNuke = new Set(ids);
      try {
        const snapRes = await fetch(`${cleanBase}/cryptron_users.json`);
        if (snapRes.ok) {
          const currentRemote = await snapRes.json();
          if (currentRemote && typeof currentRemote === 'object') {
            Object.entries(currentRemote).forEach(([fbKey, val]) => {
              if (!val) return;
              const recId = val.id ? String(val.id).trim() : '';
              const recEmail = val.email ? String(val.email).toLowerCase().trim() : '';
              if (idSet.has(fbKey) || (recId && idSet.has(recId)) || (recEmail && emailSet.has(recEmail))) {
                keysToNuke.add(fbKey);
                if (recId) keysToNuke.add(recId);
                if (recEmail) emailSet.add(recEmail);
              }
            });
          }
        }
      } catch (scanErr) {
        console.warn("CloudSync scan before delete warning:", scanErr);
      }

      // Update tombstones if additional IDs/emails were found during scan
      const allDiscoveredIds = Array.from(keysToNuke);
      const allDiscoveredEmails = Array.from(emailSet);
      if (typeof UserDatabase !== 'undefined' && UserDatabase.markUsersDeleted) {
        UserDatabase.markUsersDeleted(allDiscoveredIds, allDiscoveredEmails);
      }
      await this.pushDeletedTombstones(allDiscoveredIds, allDiscoveredEmails);

      // 3. Build atomic multi-key null PATCH for cryptron_users
      const nullPatch = {};
      allDiscoveredIds.forEach(k => {
        if (k) nullPatch[k] = null;
      });

      const deletePromises = [];

      // Atomic PATCH via REST API
      if (Object.keys(nullPatch).length > 0) {
        deletePromises.push(
          fetch(`${cleanBase}/cryptron_users.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nullPatch)
          }).catch(e => console.warn("REST PATCH null delete error:", e))
        );
      }

      // Atomic update via Firebase SDK if initialized
      if (window.firebase && firebase.apps && firebase.apps.length > 0 && Object.keys(nullPatch).length > 0) {
        deletePromises.push(
          firebase.database().ref('cryptron_users').update(nullPatch).catch(e => console.warn("SDK update null delete error:", e))
        );
      }

      // Direct DELETE on each individual endpoint for 100% certainty
      allDiscoveredIds.forEach(k => {
        if (!k) return;
        deletePromises.push(
          fetch(`${cleanBase}/cryptron_users/${encodeURIComponent(k)}.json`, {
            method: 'DELETE'
          }).catch(() => {})
        );
      });

      await Promise.all(deletePromises);
      return true;
    } catch (e) {
      console.warn("CloudSync deleteUsers failed:", e);
      return false;
    } finally {
      this._isDeleting = false;
    }
  }

  /**
   * Pull all users from cloud database and merge into local database
   */
  static async pullUsers() {
    if (this._isDeleting) return null;
    const url = this.getCloudUrl();
    if (!url) return null;
    this.initFirebase();

    const pullEpoch = this._deleteEpoch || 0;
    const cleanBase = url.replace(/\/$/, '').replace(/\/cryptron_users\.json$/, '').replace(/\.json$/, '');

    try {
      // 1. Fetch both remote tombstones and remote users in parallel
      let remoteData = null;
      let remoteDeleted = null;

      const [usersRes, deletedRes] = await Promise.all([
        fetch(`${cleanBase}/cryptron_users.json`).catch(() => null),
        fetch(`${cleanBase}/cryptron_deleted_users.json`).catch(() => null)
      ]);

      // Abort immediately if a deletion started or completed while network request was in flight
      if (this._isDeleting || (this._deleteEpoch || 0) !== pullEpoch) {
        return null;
      }

      if (deletedRes && deletedRes.ok) {
        try {
          remoteDeleted = await deletedRes.json();
          if (remoteDeleted && typeof UserDatabase !== 'undefined' && UserDatabase.syncRemoteDeletedRegistry) {
            UserDatabase.syncRemoteDeletedRegistry(remoteDeleted);
          }
        } catch (e) {}
      }

      if (usersRes && usersRes.ok) {
        remoteData = await usersRes.json();
      } else if (window.firebase && firebase.apps && firebase.apps.length > 0) {
        try {
          const snap = await firebase.database().ref('cryptron_users').once('value');
          remoteData = snap.val();
        } catch (e) {}
      }

      // Re-check epoch lock after awaiting JSON bodies
      if (this._isDeleting || (this._deleteEpoch || 0) !== pullEpoch) {
        return null;
      }

      if (remoteData && typeof remoteData === 'object') {
        const zombieKeysToPurge = {};
        const rawEntries = Array.isArray(remoteData)
          ? remoteData.map((v, idx) => [String(v && v.id ? v.id : idx), v])
          : Object.entries(remoteData);

        const remoteUsers = [];
        const remoteEmailsSet = new Set();
        const remoteIdsSet = new Set();

        rawEntries.forEach(([fbKey, val]) => {
          if (!val || typeof val !== 'object') return;
          const uid = val.id || fbKey;
          const uemail = val.email ? String(val.email).toLowerCase().trim() : '';

          // Check if this user or Firebase key was tombstoned
          if (
            typeof UserDatabase !== 'undefined' &&
            (UserDatabase.isUserDeleted(uid, uemail) || UserDatabase.isUserDeleted(fbKey, uemail))
          ) {
            zombieKeysToPurge[fbKey] = null;
            return;
          }

          const cleanVal = { ...val, id: uid, _fbKey: fbKey };
          remoteUsers.push(cleanVal);
          if (uid) remoteIdsSet.add(uid);
          if (fbKey) remoteIdsSet.add(fbKey);
          if (uemail) remoteEmailsSet.add(uemail);
        });

        // Automatically purge any zombie keys found in Firebase
        if (Object.keys(zombieKeysToPurge).length > 0) {
          fetch(`${cleanBase}/cryptron_users.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(zombieKeysToPurge)
          }).catch(() => {});
        }

        const localRaw = localStorage.getItem(USERS_DB_KEY);
        const parsedLocal = localRaw ? JSON.parse(localRaw) : [];
        const now = Date.now();

        // Filter localUsers:
        // 1. Never include tombstoned users.
        // 2. Only keep a local user that is missing from Firebase if it was created locally within the last 20 seconds
        //    (prevents deleted users from another device or stale localStorage from ever resurrecting!)
        const validLocalUsers = (Array.isArray(parsedLocal) ? parsedLocal : []).filter(u => {
          if (!u) return false;
          const uemail = u.email ? String(u.email).toLowerCase().trim() : '';
          if (typeof UserDatabase !== 'undefined' && UserDatabase.isUserDeleted(u.id, uemail)) {
            return false;
          }
          const existsInRemote = (u.id && remoteIdsSet.has(u.id)) || (uemail && remoteEmailsSet.has(uemail));
          if (existsInRemote) return true;
          const isBrandNewLocal = u._localPendingSync && (now - u._localPendingSync < 20000);
          return !!isBrandNewLocal;
        });

        const merged = this.mergeUsers(validLocalUsers, remoteUsers);

        // Save merged
        const serialized = JSON.stringify(merged);
        localStorage.setItem(USERS_DB_KEY, serialized);
        localStorage.setItem("cryptron_users_db", serialized);
        localStorage.setItem(DB_INITIALIZED_KEY, "true");

        // Synchronize active session countdown storage if the active user was merged
        try {
          const curId = UserDatabase.getCurrentUserId();
          const curUser = merged.find(u => u.id === curId);
          if (curUser && (curUser.investmentStatus === 'not_invested' || curUser.withdrawalRequest)) {
            const storedRaw = localStorage.getItem("cryptron_account_v3_countdown");
            if (storedRaw) {
              const acc = JSON.parse(storedRaw);
              acc.user = acc.user || {};
              acc.user.investmentStatus = 'not_invested';
              acc.user.hasActiveInvestment = false;
              acc.user.withdrawalRequest = curUser.withdrawalRequest || null;
              acc.user.withdrawalHistory = [];
              acc.user.pendingTxHash = null;
              acc.user.depositSubmittedAt = null;
              acc.activePlans = [];
              acc.completedPlans = [];
              acc.transactions = [];
              acc.wallet = acc.wallet || {};
              acc.wallet.availableBalance = 0.00;
              acc.wallet.investedBalance = 0.00;
              acc.wallet.totalProfits = 0.00;
              acc.wallet.pendingWithdrawal = 0.00;
              acc.user.totalDeposited = 0.00;
              acc.user.referralCount = curUser.referralCount || 0;
              acc.user.referralBypassed = !!curUser.referralBypassed;
              acc.user.lastSpinTimestamp = 0;
              localStorage.setItem("cryptron_account_v3_countdown", JSON.stringify(acc));
            }
          }
        } catch(e) {}

        window.dispatchEvent(new StorageEvent('storage', { key: USERS_DB_KEY, newValue: serialized }));
        window.dispatchEvent(new CustomEvent('cryptron_users_updated', { detail: merged }));

        // Only push brand-new pending local users that haven't reached Firebase yet
        const unsyncedNewUsers = merged.filter(u => u._localPendingSync && (now - u._localPendingSync < 20000) && !remoteIdsSet.has(u.id));
        if (unsyncedNewUsers.length > 0 && !this._isDeleting) {
          this.pushUsers(unsyncedNewUsers).catch(console.warn);
        }

        return merged;
      } else if (remoteData === null) {
        // Cloud DB cryptron_users node is empty
        const deletedReg = (typeof UserDatabase !== 'undefined' && UserDatabase.getDeletedRegistry)
          ? UserDatabase.getDeletedRegistry()
          : { ids: {}, emails: {} };
        const hasDeletions = Object.keys(deletedReg.ids || {}).length > 0 || Object.keys(deletedReg.emails || {}).length > 0;

        if (hasDeletions || localStorage.getItem(DB_INITIALIZED_KEY) === "true") {
          // All users were intentionally deleted! Keep empty array and do NOT re-seed or re-push stale users.
          const emptySerialized = JSON.stringify([]);
          localStorage.setItem(USERS_DB_KEY, emptySerialized);
          localStorage.setItem("cryptron_users_db", emptySerialized);
          window.dispatchEvent(new CustomEvent('cryptron_users_updated', { detail: [] }));
          return [];
        } else {
          // Very first time setup on an uninitialized database
          const localRaw = localStorage.getItem(USERS_DB_KEY);
          const localUsers = localRaw ? JSON.parse(localRaw) : [];
          if (localUsers && localUsers.length > 0) {
            this.pushUsers(localUsers).catch(console.warn);
          }
        }
      }
    } catch (e) {
      console.warn("CloudSync pull failed:", e);
    }
    return null;
  }

  /**
   * Merge local and remote users safely:
   * 1. Respects the persistent tombstone registry so deleted users never return.
   * 2. Uses EMAIL as primary unique identity so different people never overwrite each other.
   * 3. Preserves remote Firebase IDs as authoritative so IDs never drift from their Firebase keys.
   * 4. Sorts newest registrations first so new signups appear at the TOP of the admin table!
   */
  static mergeUsers(localUsers, remoteUsers) {
    if (!Array.isArray(remoteUsers)) return localUsers || [];
    if (!Array.isArray(localUsers)) localUsers = [];

    const userMap = new Map();
    const usedIds = new Set();
    let maxIdNum = 1000;

    const trackId = (id) => {
      if (!id) return;
      usedIds.add(id);
      const match = String(id).match(/USR-(\d+)/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxIdNum && n < 999999) maxIdNum = n;
      }
    };

    // 1. Index local users (excluding any tombstoned users)
    localUsers.forEach(u => {
      if (!u) return;
      const emailKey = u.email ? u.email.toLowerCase().trim() : null;
      if (typeof UserDatabase !== 'undefined' && UserDatabase.isUserDeleted(u.id, emailKey)) return;
      const key = emailKey || u.id;
      if (key) {
        userMap.set(key, { ...u });
      }
      trackId(u.id);
    });

    // 2. Merge remote users (authoritative from Firebase)
    remoteUsers.forEach(ru => {
      if (!ru) return;
      const emailKey = ru.email ? ru.email.toLowerCase().trim() : null;
      if (typeof UserDatabase !== 'undefined' && UserDatabase.isUserDeleted(ru.id, emailKey)) return;
      const key = emailKey || ru.id;
      if (!key) return;

      const existing = userMap.get(key);
      if (existing) {
        // Authoritative ID from Firebase
        if (ru.id) existing.id = ru.id;
        // SAME PERSON: update fields with latest information
        if (ru.name && (!existing.name || existing.name === 'Client')) existing.name = ru.name;
        if (ru.password) existing.password = ru.password;
        if (ru.passwordMasked) existing.passwordMasked = ru.passwordMasked;
        if (ru.promoCode) existing.promoCode = ru.promoCode;
        if (ru.referralCode) existing.referralCode = ru.referralCode;
        if (ru.walletAddress && (!existing.walletAddress || existing.walletAddress === '0x...')) existing.walletAddress = ru.walletAddress;
        if (ru.pendingTxHash !== undefined) existing.pendingTxHash = ru.pendingTxHash;
        if (ru.depositSubmittedAt !== undefined) existing.depositSubmittedAt = ru.depositSubmittedAt;
        if (ru.registeredAt && !existing.registeredAt) existing.registeredAt = ru.registeredAt;
        if (ru.withdrawalHistory) existing.withdrawalHistory = ru.withdrawalHistory;
        if (ru.notifications) existing.notifications = ru.notifications;

        // Determine if remote user is settled, reset, or uninvested
        const remoteIsSettledOrReset = ru.investmentStatus === 'not_invested' || 
          (ru.withdrawalHistory && ru.withdrawalHistory.length > 0 && !ru.withdrawalRequest);

        if (remoteIsSettledOrReset) {
          existing.investmentStatus = 'not_invested';
          existing.hasActiveInvestment = false;
          existing.activePlans = [];
          existing.completedPlans = [];
          existing.transactions = [];
          existing.withdrawalHistory = [];
          existing.pendingTxHash = null;
          existing.depositSubmittedAt = null;
          existing.withdrawalRequest = null;
          existing.pendingWithdrawal = 0.00;
          existing.availableBalance = 0.00;
          existing.investedBalance = 0.00;
          existing.totalProfits = 0.00;
          existing.totalDeposited = 0.00;
          existing.referralCount = ru.referralCount !== undefined ? ru.referralCount : 0;
          existing.referralBypassed = !!ru.referralBypassed;
          existing.lastSpinTimestamp = ru.lastSpinTimestamp || 0;
        } else if (ru.investmentStatus === 'active') {
          existing.investmentStatus = 'active';
          existing.hasActiveInvestment = true;
          if (ru.activePlans && Array.isArray(ru.activePlans) && ru.activePlans.length > 0) {
            existing.activePlans = ru.activePlans;
          }
          if (ru.availableBalance !== undefined) existing.availableBalance = Number(ru.availableBalance) || 0.00;
          if (ru.investedBalance !== undefined) existing.investedBalance = Number(ru.investedBalance) || 0.00;
          if (ru.totalProfits !== undefined) existing.totalProfits = Number(ru.totalProfits) || 0.00;
          if (ru.totalDeposited !== undefined) existing.totalDeposited = Number(ru.totalDeposited) || 0.00;
          existing.withdrawalRequest = ru.withdrawalRequest || null;
          if (ru.pendingWithdrawal !== undefined) existing.pendingWithdrawal = Number(ru.pendingWithdrawal) || 0.00;
          if (ru.referralCount !== undefined) existing.referralCount = ru.referralCount;
          if (ru.referralBypassed !== undefined) existing.referralBypassed = !!ru.referralBypassed;
          if (ru.lastSpinTimestamp !== undefined) existing.lastSpinTimestamp = ru.lastSpinTimestamp;
        } else if (ru.investmentStatus === 'pending_approval') {
          existing.investmentStatus = 'pending_approval';
          existing.hasActiveInvestment = false;
          existing.activePlans = [];
          if (ru.availableBalance !== undefined) existing.availableBalance = Number(ru.availableBalance) || 0.00;
          if (ru.investedBalance !== undefined) existing.investedBalance = Number(ru.investedBalance) || 0.00;
          if (ru.totalProfits !== undefined) existing.totalProfits = Number(ru.totalProfits) || 0.00;
          if (ru.totalDeposited !== undefined) existing.totalDeposited = Number(ru.totalDeposited) || 0.00;
          existing.withdrawalRequest = ru.withdrawalRequest || null;
          if (ru.pendingWithdrawal !== undefined) existing.pendingWithdrawal = Number(ru.pendingWithdrawal) || 0.00;
        } else if (ru.investmentStatus === 'matured') {
          existing.investmentStatus = 'matured';
          existing.hasActiveInvestment = false;
          if (ru.availableBalance !== undefined) existing.availableBalance = Number(ru.availableBalance) || 0.00;
          if (ru.totalProfits !== undefined) existing.totalProfits = Number(ru.totalProfits) || 0.00;
          existing.withdrawalRequest = ru.withdrawalRequest || null;
          if (ru.pendingWithdrawal !== undefined) existing.pendingWithdrawal = Number(ru.pendingWithdrawal) || 0.00;
          if (ru.referralCount !== undefined) existing.referralCount = ru.referralCount;
          if (ru.referralBypassed !== undefined) existing.referralBypassed = !!ru.referralBypassed;
        } else {
          if (ru.investmentStatus !== undefined) existing.investmentStatus = ru.investmentStatus;
          if (ru.availableBalance !== undefined) existing.availableBalance = Number(ru.availableBalance) || 0.00;
          if (ru.investedBalance !== undefined) existing.investedBalance = Number(ru.investedBalance) || 0.00;
          if (ru.totalProfits !== undefined) existing.totalProfits = Number(ru.totalProfits) || 0.00;
          if (ru.totalDeposited !== undefined) existing.totalDeposited = Number(ru.totalDeposited) || 0.00;
          existing.withdrawalRequest = ru.withdrawalRequest || null;
          if (ru.pendingWithdrawal !== undefined) existing.pendingWithdrawal = Number(ru.pendingWithdrawal) || 0.00;
        }
        trackId(existing.id);
      } else {
        // NEW PERSON FROM REMOTE! Preserve their exact Firebase ID unless completely missing
        const newUser = { ...ru };
        delete newUser._fbKey;
        if (!newUser.id) {
          maxIdNum++;
          newUser.id = "USR-" + maxIdNum;
        }
        trackId(newUser.id);
        userMap.set(key, newUser);
      }
    });

    const mergedList = Array.from(userMap.values()).filter(u => {
      return u && !(typeof UserDatabase !== 'undefined' && UserDatabase.isUserDeleted(u.id, u.email));
    });

    // Sort newest registrations first so new signups appear at the TOP of the admin table!
    mergedList.sort((a, b) => {
      const timeA = a.registeredAt ? new Date(a.registeredAt.replace(' ', 'T')).getTime() : 0;
      const timeB = b.registeredAt ? new Date(b.registeredAt.replace(' ', 'T')).getTime() : 0;
      if (timeB && timeA && timeB !== timeA) return timeB - timeA;
      // Fallback: compare ID numbers descending
      const numA = parseInt((a.id || '').replace(/\D/g, '') || 0, 10);
      const numB = parseInt((b.id || '').replace(/\D/g, '') || 0, 10);
      return numB - numA;
    });

    return mergedList;
  }

  static initRealtimeListener(onUpdateCallback) {
    const url = this.getCloudUrl();
    if (!url) return;
    this.initFirebase();

    // 1. Initial immediate pull
    CloudSyncEngine.pullUsers().then(merged => {
      if (merged && onUpdateCallback) onUpdateCallback(merged);
    });

    // 2. Firebase live WebSocket listener (delegates through pullUsers so tombstones & locks are enforced)
    try {
      if (window.firebase && firebase.apps && firebase.apps.length > 0) {
        firebase.database().ref('cryptron_users').on('value', () => {
          if (CloudSyncEngine._isDeleting) return;
          CloudSyncEngine.pullUsers().then(merged => {
            if (merged && onUpdateCallback) onUpdateCallback(merged);
          });
        });
      }
    } catch(e) {
      console.warn("Realtime listener init error:", e);
    }

    // 3. Robust 2.5-second polling backup (ensures updates even if WebSockets are throttled)
    setInterval(() => {
      if (CloudSyncEngine._isDeleting) return;
      CloudSyncEngine.pullUsers().then(merged => {
        if (merged && onUpdateCallback) onUpdateCallback(merged);
      });
    }, 2500);
  }
}

if (typeof window !== 'undefined') {
  window.CloudSyncEngine = CloudSyncEngine;
}

class UserDatabase {
  /**
   * Retrieve the persistent tombstone registry of permanently deleted user IDs & emails
   */
  static getDeletedRegistry() {
    try {
      const raw = localStorage.getItem(DELETED_USERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ids: (parsed && parsed.ids && typeof parsed.ids === 'object') ? parsed.ids : {},
          emails: (parsed && parsed.emails && typeof parsed.emails === 'object') ? parsed.emails : {}
        };
      }
    } catch (e) {}
    return { ids: {}, emails: {} };
  }

  static saveDeletedRegistry(reg) {
    try {
      localStorage.setItem(DELETED_USERS_KEY, JSON.stringify({
        ids: (reg && reg.ids) || {},
        emails: (reg && reg.emails) || {}
      }));
    } catch (e) {}
  }

  /**
   * Mark one or more user IDs and emails as permanently deleted
   */
  static markUsersDeleted(ids = [], emails = []) {
    const reg = this.getDeletedRegistry();
    const now = Date.now();
    (ids || []).forEach(id => {
      if (!id) return;
      const cleanId = String(id).trim();
      reg.ids[cleanId] = now;
      reg.ids[cleanId.toUpperCase()] = now;
    });
    (emails || []).forEach(email => {
      if (!email) return;
      const cleanEmail = String(email).toLowerCase().trim();
      reg.emails[cleanEmail] = now;
      if (typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.sanitizeFirebaseKey) {
        reg.emails[CloudSyncEngine.sanitizeFirebaseKey(cleanEmail)] = now;
      }
    });
    this.saveDeletedRegistry(reg);
  }

  /**
   * Unmark a user ID / email when they explicitly register a fresh account
   */
  static unmarkUserDeleted(id = null, email = null) {
    const reg = this.getDeletedRegistry();
    let changed = false;
    if (id) {
      const cleanId = String(id).trim();
      if (reg.ids[cleanId] || reg.ids[cleanId.toUpperCase()]) {
        delete reg.ids[cleanId];
        delete reg.ids[cleanId.toUpperCase()];
        changed = true;
      }
    }
    if (email) {
      const cleanEmail = String(email).toLowerCase().trim();
      const safeKey = (typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.sanitizeFirebaseKey)
        ? CloudSyncEngine.sanitizeFirebaseKey(cleanEmail)
        : cleanEmail.replace(/[.#$\[\]\/]/g, '_');
      if (reg.emails[cleanEmail] || reg.emails[safeKey]) {
        delete reg.emails[cleanEmail];
        delete reg.emails[safeKey];
        changed = true;
      }
    }
    if (changed) {
      this.saveDeletedRegistry(reg);
    }
    if (typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.isConnected()) {
      CloudSyncEngine.removeDeletedTombstone(id, email).catch(() => {});
    }
  }

  /**
   * Check whether a user ID or email has been permanently deleted
   */
  static isUserDeleted(id, email) {
    const reg = this.getDeletedRegistry();
    if (id) {
      const cleanId = String(id).trim();
      if (reg.ids[cleanId] || reg.ids[cleanId.toUpperCase()]) return true;
    }
    if (email) {
      const cleanEmail = String(email).toLowerCase().trim();
      const safeKey = (typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.sanitizeFirebaseKey)
        ? CloudSyncEngine.sanitizeFirebaseKey(cleanEmail)
        : cleanEmail.replace(/[.#$\[\]\/]/g, '_');
      if (reg.emails[cleanEmail] || reg.emails[safeKey]) return true;
    }
    return false;
  }

  /**
   * Merge remote deleted registry from Firebase into localStorage
   */
  static syncRemoteDeletedRegistry(remoteReg) {
    if (!remoteReg || typeof remoteReg !== 'object') return;
    const reg = this.getDeletedRegistry();
    let changed = false;

    if (remoteReg.ids && typeof remoteReg.ids === 'object') {
      Object.keys(remoteReg.ids).forEach(k => {
        if (k && !reg.ids[k]) {
          reg.ids[k] = remoteReg.ids[k] || Date.now();
          reg.ids[k.toUpperCase()] = remoteReg.ids[k] || Date.now();
          changed = true;
        }
      });
    }
    if (remoteReg.emails && typeof remoteReg.emails === 'object') {
      Object.entries(remoteReg.emails).forEach(([k, val]) => {
        if (k && !reg.emails[k]) {
          reg.emails[k] = Date.now();
          changed = true;
        }
        if (typeof val === 'string' && val.includes('@')) {
          const cleanVal = val.toLowerCase().trim();
          if (!reg.emails[cleanVal]) {
            reg.emails[cleanVal] = Date.now();
            changed = true;
          }
        }
      });
    }
    if (changed) {
      this.saveDeletedRegistry(reg);
    }
  }

  /**
   * Generate a promo code composed of the client's first name and random numbers.
   * e.g. "David Miller" -> "DAVID8821", "Elena Rostova" -> "ELENA4419"
   * @param {string} name - Client's full name
   * @param {string} id - Optional user ID
   * @returns {string} Unique promo code
   */
  static generatePromoCode(name, id = null) {
    let firstName = "";
    if (name && typeof name === "string") {
      const parts = name.trim().split(/[\s._-]+/);
      for (const part of parts) {
        const stripped = part.replace(/[^a-zA-Z]/g, '').toUpperCase();
        if (stripped.length >= 2) {
          firstName = stripped;
          break;
        }
      }
      if (!firstName && parts[0]) {
        firstName = parts[0].replace(/[^a-zA-Z]/g, '').toUpperCase();
      }
    }
    if (!firstName) firstName = "CRYP";
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${firstName}${randomSuffix}`;
  }

  /**
   * Retrieve all registered users from database
   * @returns {Array} Array of user objects
   */
  static getAllUsers() {
    let users = null;
    const raw = localStorage.getItem(USERS_DB_KEY) !== null
      ? localStorage.getItem(USERS_DB_KEY)
      : localStorage.getItem("cryptron_users_db");

    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          users = parsed;
        }
      } catch (e) {
        console.error("Failed to parse user database:", e);
      }
    }

    if (users === null) {
      const deletedReg = this.getDeletedRegistry();
      const hasDeletions = Object.keys(deletedReg.ids).length > 0 || Object.keys(deletedReg.emails).length > 0;
      if (hasDeletions || localStorage.getItem(DB_INITIALIZED_KEY) === "true") {
        users = [];
      } else {
        users = JSON.parse(JSON.stringify(SEED_USERS));
      }
      localStorage.setItem(DB_INITIALIZED_KEY, "true");
      this.saveUsers(users, { skipCloudPush: true });
    }

    // Filter out any users that have been permanently deleted
    const beforeFilterLen = users.length;
    users = users.filter(u => u && !this.isUserDeleted(u.id, u.email));
    let updated = users.length !== beforeFilterLen;

    // Safeguard: reconcile any user found in cryptron_account_v3_countdown ONLY if not deleted
    try {
      const activeAcctRaw = localStorage.getItem("cryptron_account_v3_countdown");
      if (activeAcctRaw) {
        const activeAcct = JSON.parse(activeAcctRaw);
        if (activeAcct && activeAcct.user && activeAcct.user.id && activeAcct.user.email) {
          if (this.isUserDeleted(activeAcct.user.id, activeAcct.user.email)) {
            // Active session user was deleted by admin — purge stale countdown storage so it never resurrects
            localStorage.removeItem("cryptron_account_v3_countdown");
          } else {
            const exists = users.some(u => u.id === activeAcct.user.id || u.email.toLowerCase() === activeAcct.user.email.toLowerCase());
            if (!exists) {
              const pCode = activeAcct.user.promoCode || activeAcct.user.referralCode || UserDatabase.generatePromoCode(activeAcct.user.name, activeAcct.user.id);
              users.unshift({
                id: activeAcct.user.id,
                name: activeAcct.user.name || "Client",
                email: activeAcct.user.email,
                password: "password123",
                passwordMasked: "••••••••",
                registeredAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
                walletAddress: activeAcct.user.walletAddress || "0x...",
                promoCode: pCode,
                referralCode: pCode,
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
              updated = true;
            }
          }
        }
      }
    } catch(e) {}

    // Ensure all users have valid promo codes (client's first name + random numbers)
    users.forEach(u => {
      // If missing promoCode or not in [FIRSTNAME][NUMBERS] format
      if (!u.promoCode || !/^[A-Za-z]+[0-9]+$/.test(u.promoCode)) {
        u.promoCode = UserDatabase.generatePromoCode(u.name, u.id);
        u.referralCode = u.promoCode;
        updated = true;
      }
      if (!u.referralCode) {
        u.referralCode = u.promoCode;
        updated = true;
      }
      if (u.referralCount === undefined) {
        u.referralCount = 0;
        updated = true;
      }
      if (u.lastSpinTimestamp === undefined || u.lastSpinTimestamp === null) {
        u.lastSpinTimestamp = 0;
        updated = true;
      }
    });

    if (updated) {
      this.saveUsers(users, { skipCloudPush: true });
    }

    // Background sync with cloud database if connected
    if (typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.isConnected() && !this._isPullingCloud && !CloudSyncEngine._isDeleting) {
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
  static saveUsers(users, options = {}) {
    const cleanUsers = (Array.isArray(users) ? users : []).filter(u => u && !this.isUserDeleted(u.id, u.email));
    const serialized = JSON.stringify(cleanUsers);
    localStorage.setItem(USERS_DB_KEY, serialized);
    localStorage.setItem("cryptron_users_db", serialized);
    localStorage.setItem(DB_INITIALIZED_KEY, "true");
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        if (typeof StorageEvent !== 'undefined') {
          window.dispatchEvent(new StorageEvent('storage', {
            key: USERS_DB_KEY,
            newValue: serialized
          }));
        }
        if (typeof CustomEvent !== 'undefined') {
          window.dispatchEvent(new CustomEvent('cryptron_users_updated', { detail: cleanUsers }));
        }
      }
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('cryptron_bus');
        bc.postMessage({ type: 'USERS_UPDATED', users: cleanUsers });
        bc.close();
      }

      // Synchronize globally with Cloud Database (unless skipped during delete or local filter)
      if (!options.skipCloudPush && typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.isConnected() && !CloudSyncEngine._isDeleting) {
        CloudSyncEngine.pushUsers(cleanUsers);
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
   * Credit a referral count to the user matching the given promo code or referral code
   * @param {string} promoCodeOrId - e.g. "DAVID8821" or "USR-1001"
   */
  static creditReferral(promoCodeOrId) {
    if (!promoCodeOrId) return null;
    const users = this.getAllUsers();
    const clean = promoCodeOrId.trim().toUpperCase();

    // Match by promo code, referral code, or user ID
    let referrer = users.find(u => 
      (u.promoCode && u.promoCode.toUpperCase() === clean) || 
      (u.referralCode && u.referralCode.toUpperCase() === clean) ||
      (u.id && u.id.toUpperCase() === clean)
    );
    if (!referrer) {
      const parts = clean.split('-');
      if (parts.length >= 2) {
        const candidateId = "usr-" + parts[1].toLowerCase();
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
   * Calculate next available unique USR-XXXX ID based on highest existing ID
   */
  static getNextUserId(users = []) {
    let max = 1000;
    (users || []).forEach(u => {
      if (u && u.id) {
        const m = String(u.id).match(/USR-(\d+)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n > max && n < 999999) max = n;
        }
      }
    });
    // Also check deleted user IDs so we never reuse a tombstoned USR-XXXX ID
    try {
      const delReg = this.getDeletedRegistry();
      Object.keys(delReg.ids || {}).forEach(delId => {
        const m = String(delId).match(/USR-(\d+)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n > max && n < 999999) max = n;
        }
      });
    } catch (e) {}
    return "USR-" + (max + 1);
  }

  /**
   * Register a new user into the database with client first name + random number promo code
   */
  static registerUser(name, email, password, referredByCode = null) {
    const cleanEmail = email.toLowerCase().trim();
    // If this email was previously deleted by admin and is now genuinely signing up afresh, unmark tombstone
    this.unmarkUserDeleted(null, cleanEmail);

    const users = this.getAllUsers();
    
    // Check if email already exists
    const existing = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error("An account with this email address already exists.");
    }

    const newId = this.getNextUserId(users);
    this.unmarkUserDeleted(newId, cleanEmail);

    // Promo code composed of client's first name and random numbers
    const promoCode = this.generatePromoCode(name, newId);
    const mockWallet = "0x" + Math.random().toString(16).substring(2, 10) + "..." + Math.random().toString(16).substring(2, 6);
    
    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);
    const cleanReferredBy = referredByCode ? referredByCode.trim().toUpperCase() : null;

    const newUser = {
      id: newId,
      name: name.trim(),
      email: cleanEmail,
      password: password || "password123",
      passwordMasked: "••••••••",
      registeredAt: dateStr,
      walletAddress: mockWallet,
      promoCode: promoCode,
      referralCode: promoCode,
      referralCount: 0,
      referredBy: cleanReferredBy,
      referralSpinCredited: false, // Set to true once this referral deposits $10 and spins the wheel
      lastSpinTimestamp: 0, // Unlocked fresh daily spin
      investmentStatus: "not_invested", // Starts with no investment until approved
      pendingTxHash: null,
      totalDeposited: 0.00,
      availableBalance: 0.00,
      totalProfits: 0.00,
      status: "Active",
      activePlans: [],
      _localPendingSync: Date.now()
    };

    users.unshift(newUser);
    this.saveUsers(users);

    // Immediately push new user to Cloud Database for worldwide admin sync
    if (typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.isConnected()) {
      CloudSyncEngine.pushUser(newUser).catch(console.warn);
    }

    // Automatically dispatch signup details email to cryptronvest@gmail.com (if not already handled by login page form)
    const isLoginPage = (typeof window !== 'undefined' && window.location && window.location.pathname && window.location.pathname.includes('login'));
    if (!isLoginPage) {
      if (typeof EmailService !== 'undefined' && EmailService.sendSignupNotificationToAdmin) {
        try {
          EmailService.sendSignupNotificationToAdmin(newUser).catch(console.warn);
        } catch (e) {
          console.warn("Could not dispatch signup notification email:", e);
        }
      } else if (typeof window !== 'undefined' && window.EmailService && window.EmailService.sendSignupNotificationToAdmin) {
        try {
          window.EmailService.sendSignupNotificationToAdmin(newUser).catch(console.warn);
        } catch (e) {
          console.warn("Could not dispatch signup notification email:", e);
        }
      }
    }

    // Set as active session
    this.setCurrentUserId(newUser.id);

    return newUser;
  }

  /**
   * Record that a user has spun the wheel and credit their inviter if this is their first spin
   * (Rule: Referrals must sign up with promo code, deposit $10, and spin the wheel for the inviter to receive credit)
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

      // Find referrer by promo code, referral code, or user id
      let referrer = users.find(u => 
        (u.promoCode && u.promoCode.toUpperCase() === clean) || 
        (u.referralCode && u.referralCode.toUpperCase() === clean) ||
        (u.id && u.id.toUpperCase() === clean)
      );
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
   * Get list of users referred by a specific promo code or user ID
   */
  static getReferralsForUser(promoCodeOrId) {
    if (!promoCodeOrId) return [];
    const users = this.getAllUsers();
    const clean = promoCodeOrId.trim().toUpperCase();
    
    // Find the owner user to know their ID, promoCode, and referralCode
    const owner = users.find(u => 
      (u.id && u.id.toUpperCase() === clean) || 
      (u.promoCode && u.promoCode.toUpperCase() === clean) || 
      (u.referralCode && u.referralCode.toUpperCase() === clean)
    );

    return users.filter(u => {
      if (!u.referredBy) return false;
      const refBy = u.referredBy.trim().toUpperCase();
      if (refBy === clean) return true;
      if (owner) {
        if (owner.promoCode && refBy === owner.promoCode.toUpperCase()) return true;
        if (owner.referralCode && refBy === owner.referralCode.toUpperCase()) return true;
        if (owner.id && refBy === owner.id.toUpperCase()) return true;
      }
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

    // Automatically notify admin of user sign-in
    if (typeof EmailService !== 'undefined' && EmailService.sendSigninNotificationToAdmin) {
      try {
        EmailService.sendSigninNotificationToAdmin(user).catch(console.warn);
      } catch (e) {}
    } else if (typeof window !== 'undefined' && window.EmailService && window.EmailService.sendSigninNotificationToAdmin) {
      try {
        window.EmailService.sendSigninNotificationToAdmin(user).catch(console.warn);
      } catch (e) {}
    }

    return user;
  }

  /**
   * Request a 6-digit verification code to reset password
   * @param {string} email - Registered email
   */
  static async requestPasswordReset(email) {
    let user = this.getUserByEmail(email);
    if (!user && typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.isConnected()) {
      try {
        await CloudSyncEngine.pullUsers();
        user = this.getUserByEmail(email);
      } catch (e) {
        console.warn("Cloud pull before reset check:", e);
      }
    }
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

    // Immediately push resetCode state to Firebase Cloud Database
    if (typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.isConnected()) {
      CloudSyncEngine.pushUser(user).catch(console.warn);
    }

    // Dispatch real email with the code to user and outbox
    if (window.EmailService) {
      try {
        await EmailService.sendPasswordResetEmail(user, resetCode);
      } catch (e) {
        console.warn("sendPasswordResetEmail dispatch warning:", e);
      }
    }

    return { user, resetCode };
  }

  /**
   * Complete password reset using verification code
   * @param {string} email - User email
   * @param {string} code - 6-digit code received
   * @param {string} newPassword - New password chosen by user
   */
  static async resetPasswordWithCode(email, code, newPassword) {
    let user = this.getUserByEmail(email);
    if (!user && typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.isConnected()) {
      try {
        await CloudSyncEngine.pullUsers();
        user = this.getUserByEmail(email);
      } catch (e) {
        console.warn("Cloud pull before verify:", e);
      }
    }
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
    user.passwordMasked = '••••••••';
    user.resetCode = null;
    user.resetCodeExpires = null;

    const users = this.getAllUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      users[idx] = user;
      this.saveUsers(users);
    }

    // Immediately push to Firebase Cloud Database
    if (typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.isConnected()) {
      try {
        await CloudSyncEngine.pushUser(user);
      } catch (e) {
        console.warn("Cloud push warning:", e);
      }
    }

    if (window.EmailService) {
      try {
        await EmailService.sendPasswordChangedEmail(user);
      } catch (e) {
        console.warn("Password changed notification email warning:", e);
      }
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
    user.lastSpinTimestamp = 0; // Fresh daily spin guaranteed on countdown start day!

    this.saveUsers(users);

    // Sync approval to cloud database immediately so client device receives it
    if (typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.isConnected()) {
      CloudSyncEngine.pushUser(user).catch(console.warn);
    }

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
        acc.user.lastSpinTimestamp = 0;
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
   * ADMIN ACTION: Reset User Investment & Account - Starts Completely Afresh ($0.00 Balances)
   */
  static deactivateUserInvestment(userId) {
    const users = this.getAllUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error("User not found");

    user.activePlans = [];
    user.completedPlans = [];
    user.transactions = [];
    user.withdrawalHistory = [];
    user.investmentStatus = "not_invested";
    user.hasActiveInvestment = false;
    user.pendingTxHash = null;
    user.depositSubmittedAt = null;
    user.availableBalance = 0.00;
    user.investedBalance = 0.00;
    user.totalProfits = 0.00;
    user.totalDeposited = 0.00;
    user.pendingWithdrawal = 0.00;
    user.withdrawalRequest = null;
    user.lastSpinTimestamp = 0;
    user.referralCount = 0;
    user.referralBypassed = false;

    this.saveUsers(users);

    // Push reset state to cloud database so all devices reflect the reset immediately
    if (typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.isConnected()) {
      CloudSyncEngine.pushUser(user).catch(console.warn);
    }

    try {
      const stored = localStorage.getItem("cryptron_account_v3_countdown");
      if (stored) {
        const acc = JSON.parse(stored);
        if (!acc.user || acc.user.id === userId || (user.email && acc.user.email && acc.user.email.toLowerCase() === user.email.toLowerCase()) || this.getCurrentUserId() === userId || userId === "USR-1001") {
          acc.user = acc.user || {};
          acc.user.withdrawalRequest = null;
          acc.user.hasActiveInvestment = false;
          acc.user.investmentStatus = "not_invested";
          acc.user.withdrawalHistory = [];
          acc.user.pendingTxHash = null;
          acc.user.depositSubmittedAt = null;
          acc.activePlans = [];
          acc.completedPlans = [];
          acc.transactions = [];
          acc.wallet = acc.wallet || {};
          acc.wallet.availableBalance = 0.00;
          acc.wallet.investedBalance = 0.00;
          acc.wallet.totalProfits = 0.00;
          acc.wallet.pendingWithdrawal = 0.00;
          acc.user.totalDeposited = 0.00;
          acc.user.referralCount = 0;
          acc.user.referralBypassed = false;
          acc.user.lastSpinTimestamp = 0;
          localStorage.setItem("cryptron_account_v3_countdown", JSON.stringify(acc));
        }
      }
    } catch (e) {}

    return user;
  }

  /**
   * CLIENT ACTION: Submit Payment Confirmation / Transaction Hash
   * Puts account into 'pending_approval' so admin can review and start timer.
   */
  static submitDepositConfirmation(userId, txHash) {
    const users = this.getAllUsers();
    let user = users.find(u => u.id === userId);
    if (!user) {
      user = users.find(u => u.id === this.getCurrentUserId());
    }
    if (!user && users.length > 0) {
      user = users[0];
    }
    if (!user) {
      user = { id: userId || "USR-1001", name: "Cryptronvest Investor", email: "client@cryptronvest.com" };
    }

    user.investmentStatus = "pending_approval";
    user.pendingTxHash = (txHash || '').trim();
    user.depositSubmittedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

    if (users.some(u => u.id === user.id)) {
      this.saveUsers(users);
    }

    // Immediately push transaction hash to cloud database for worldwide admin sync
    if (typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.isConnected()) {
      CloudSyncEngine.pushUser(user).catch(console.warn);
    }

    // Automatically dispatch email to cryptronvest@gmail.com with client details & txHash
    if (typeof EmailService !== 'undefined' && EmailService.sendDepositNoticeToAdmin) {
      try {
        EmailService.sendDepositNoticeToAdmin(user, txHash).catch(console.warn);
      } catch (e) {
        console.warn("Could not dispatch deposit notification email:", e);
      }
    } else if (typeof window !== 'undefined' && window.EmailService && window.EmailService.sendDepositNoticeToAdmin) {
      try {
        window.EmailService.sendDepositNoticeToAdmin(user, txHash).catch(console.warn);
      } catch (e) {
        console.warn("Could not dispatch deposit notification email:", e);
      }
    }

    return user;
  }

  /**
   * ADMIN ACTION: Delete a user permanently from the database and Firebase Cloud
   * @param {string} userId - ID of user to delete
   */
  static async deleteUser(userId) {
    if (!userId) throw new Error("User ID is required.");
    let users = this.getAllUsers();
    const targetUser = users.find(u => u.id === userId) || { id: userId };
    await this.deleteUsersBulk([userId]);
    return targetUser;
  }

  /**
   * ADMIN ACTION: Bulk delete multiple users permanently from database & Firebase Cloud
   * @param {Array<string>} userIds 
   */
  static async deleteUsersBulk(userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) return [];
    let users = this.getAllUsers();

    const idSet = new Set(userIds.filter(Boolean).map(id => String(id).trim()));
    const emailSet = new Set();

    users.forEach(u => {
      if (!u) return;
      if (idSet.has(u.id) || (u._fbKey && idSet.has(u._fbKey))) {
        if (u.id) idSet.add(u.id);
        if (u._fbKey) idSet.add(u._fbKey);
        if (u.email) emailSet.add(String(u.email).toLowerCase().trim());
      }
    });

    const allIdsToDelete = Array.from(idSet);
    const allEmailsToDelete = Array.from(emailSet);

    // 1. Immediately mark IDs and Emails in persistent tombstone registry
    this.markUsersDeleted(allIdsToDelete, allEmailsToDelete);

    // 2. Remove from local users array (by both ID and Email) and save without triggering a re-push
    users = users.filter(u => {
      if (!u) return false;
      const uemail = u.email ? String(u.email).toLowerCase().trim() : '';
      if (idSet.has(u.id) || (u._fbKey && idSet.has(u._fbKey)) || (uemail && emailSet.has(uemail))) {
        return false;
      }
      return !this.isUserDeleted(u.id, uemail);
    });
    this.saveUsers(users, { skipCloudPush: true });

    // 3. Purge active countdown session if it belongs to any deleted user
    try {
      const activeAcctRaw = localStorage.getItem("cryptron_account_v3_countdown");
      if (activeAcctRaw) {
        const activeAcct = JSON.parse(activeAcctRaw);
        const activeId = activeAcct && activeAcct.user && activeAcct.user.id;
        const activeEmail = activeAcct && activeAcct.user && activeAcct.user.email
          ? String(activeAcct.user.email).toLowerCase().trim()
          : '';
        if ((activeId && idSet.has(activeId)) || (activeEmail && emailSet.has(activeEmail))) {
          localStorage.removeItem("cryptron_account_v3_countdown");
        }
      }
    } catch (e) {}

    // 4. If deleted user was active session, switch to next available user or clear
    if (idSet.has(this.getCurrentUserId())) {
      if (users.length > 0) {
        this.setCurrentUserId(users[0].id);
      } else {
        localStorage.removeItem(CURRENT_USER_KEY);
      }
    }

    // 5. Permanently expunge from Firebase Cloud Database (and push cloud tombstones)
    if (typeof CloudSyncEngine !== 'undefined') {
      try {
        await CloudSyncEngine.deleteUsers(allIdsToDelete, allEmailsToDelete);
      } catch (e) {
        console.warn("CloudSyncEngine bulk delete warning:", e);
      }
    }

    return allIdsToDelete;
  }

  /**
   * Export all users to a CSV file (Excel compatible)
   */
  static exportUsersCSV() {
    const users = this.getAllUsers();
    let csv = "User ID,Full Name,Email Address,Registered Date,Wallet Address,Promo Code,Referred By,Investment Status,Active Contracts,Total Deposited,Submitted Tx Hash,Status\n";
    
    users.forEach(u => {
      const activeCount = (u.activePlans || []).length;
      const pCode = u.promoCode || u.referralCode || '';
      csv += `"${u.id}","${u.name}","${u.email}","${u.registeredAt}","${u.walletAddress}","${pCode}","${u.referredBy || 'None'}","${u.investmentStatus}","${activeCount}","$${u.totalDeposited || 0}","${u.pendingTxHash || 'N/A'}","${u.status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `CRYPTRONVEST_Users_Database_${new Date().toISOString().substring(0,10)}.csv`);
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

    // Push matured state to cloud database for worldwide real-time sync
    if (typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.isConnected()) {
      CloudSyncEngine.pushUser(user).catch(console.warn);
    }

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

    // RULE: When withdrawal has been hit, account has to reset as if no transaction has been made on it at all!
    user.completedPlans = [];
    user.activePlans = [];
    user.transactions = [];
    user.withdrawalHistory = [];
    user.pendingTxHash = null;
    user.depositSubmittedAt = null;
    user.hasActiveInvestment = false;
    user.investmentStatus = "not_invested";
    user.availableBalance = 0.00;
    user.investedBalance = 0.00;
    user.totalProfits = 0.00;
    user.totalDeposited = 0.00;
    user.pendingWithdrawal = 0.00;
    user.referralCount = 0; // Starts afresh for the next cycle
    user.referralBypassed = false;
    user.lastSpinTimestamp = 0; // Fresh state for subsequent deposit

    this.saveUsers(users);

    // Push to cloud database for worldwide real-time sync
    if (typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.isConnected()) {
      CloudSyncEngine.pushUser(user).catch(console.warn);
    }

    // Dispatch payout request submission message to client inbox
    try {
      this.sendMessage({
        targetType: "individual",
        targetUserId: userId,
        targetUserName: user.name,
        subject: `💵 Payout Request Received: $${parsedAmount.toFixed(2)} USDT`,
        body: `Hello ${user.name},\n\nYour payout request for $${parsedAmount.toFixed(2)} USDT has been successfully recorded and queued for settlement.\n\n• Payout Amount: $${parsedAmount.toFixed(2)} USDT\n• Receiving Address: ${usdtAddress.trim()}\n• Network: ${network}\n• Status: Pending Admin Settlement\n• Request ID: ${reqId}\n\nOur operations team has received your destination address and is queuing your payment for on-chain dispatch. You will receive an on-chain transaction hash message once funds are sent.\n\nEverything starts afresh: you may deposit $10.00 USDT at any time to begin your next 7-day vault cycle and spin the wheel!`,
        priority: "info",
        category: "Payout Request"
      });
    } catch (e) {
      console.warn("Could not dispatch payout request message:", e);
    }

    // Dispatch automated email notification if EmailService is available
    if (window.EmailService) {
      try {
        EmailService.sendPayoutRequestedEmail(user, user.withdrawalRequest).catch(console.warn);
        if (EmailService.sendWithdrawalNoticeToAdmin) {
          EmailService.sendWithdrawalNoticeToAdmin(user, user.withdrawalRequest).catch(console.warn);
        }
      } catch (e) {}
    }

    // Sync active session if this is the active user
    try {
      const stored = localStorage.getItem("cryptron_account_v3_countdown");
      if (stored) {
        const acc = JSON.parse(stored);
        if (!acc.user || acc.user.id === userId || (user.email && acc.user.email && acc.user.email.toLowerCase() === user.email.toLowerCase()) || this.getCurrentUserId() === userId || userId === "USR-1001") {
          acc.user = acc.user || {};
          acc.user.withdrawalRequest = user.withdrawalRequest;
          acc.user.hasActiveInvestment = false;
          acc.user.investmentStatus = "not_invested";
          acc.user.withdrawalHistory = [];
          acc.user.pendingTxHash = null;
          acc.user.depositSubmittedAt = null;
          acc.activePlans = [];
          acc.completedPlans = [];
          acc.transactions = [];
          acc.wallet = acc.wallet || {};
          acc.wallet.availableBalance = 0.00;
          acc.wallet.investedBalance = 0.00;
          acc.wallet.totalProfits = 0.00;
          acc.wallet.pendingWithdrawal = 0.00;
          acc.user.totalDeposited = 0.00;
          acc.user.referralCount = 0;
          acc.user.referralBypassed = false;
          acc.user.lastSpinTimestamp = 0;
          localStorage.setItem("cryptron_account_v3_countdown", JSON.stringify(acc));
        }
      }
    } catch (e) {}

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

    user.withdrawalHistory = [];
    user.withdrawalRequest = null;
    user.completedPlans = [];
    user.activePlans = [];
    user.transactions = [];
    user.pendingTxHash = null;
    user.depositSubmittedAt = null;
    user.pendingWithdrawal = 0.00;
    user.availableBalance = 0.00;
    user.investedBalance = 0.00;
    user.totalProfits = 0.00;
    user.totalDeposited = 0.00;
    user.hasActiveInvestment = false;
    user.investmentStatus = "not_invested";
    user.referralCount = 0;
    user.referralBypassed = false;
    user.lastSpinTimestamp = 0;

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

    // Push fully reset state to cloud database for worldwide real-time sync
    if (typeof CloudSyncEngine !== 'undefined' && CloudSyncEngine.isConnected()) {
      CloudSyncEngine.pushUser(user).catch(console.warn);
    }

    // Dispatch official protocol message to client inbox
    try {
      this.sendMessage({
        targetType: "individual",
        targetUserId: userId,
        targetUserName: user.name,
        subject: `✅ USDT Payout Dispatched & Settled: $${settledReq.amount.toFixed(2)} USDT`,
        body: `Hello ${user.name},\n\nGreat news! Your requested payout of $${settledReq.amount.toFixed(2)} USDT has been successfully processed and dispatched to your USDT Tether receiving address!\n\n• Payout Amount: $${settledReq.amount.toFixed(2)} USDT\n• Receiving Address: ${settledReq.usdtAddress}\n• Network: ${settledReq.network || 'USDT TRC-20'}\n• Transaction Hash: ${hash}\n• Settled At: ${settledReq.settledAt}\n\nYour 7-day contract has completed successfully and your account has started afresh ($0.00). Deposit $10.00 USDT now to start a new 7-day vault to $25 and unlock your daily spins on the $10,000 Lucky Wheel!`,
        priority: "success",
        category: "Payout Settlement"
      });
    } catch (e) {
      console.warn("Could not dispatch payout settlement message:", e);
    }

    try {
      const stored = localStorage.getItem("cryptron_account_v3_countdown");
      if (stored) {
        const acc = JSON.parse(stored);
        if (!acc.user || acc.user.id === userId || (user.email && acc.user.email && acc.user.email.toLowerCase() === user.email.toLowerCase()) || this.getCurrentUserId() === userId || userId === "USR-1001") {
          acc.user = acc.user || {};
          acc.user.withdrawalRequest = null;
          acc.user.hasActiveInvestment = false;
          acc.user.investmentStatus = "not_invested";
          acc.user.withdrawalHistory = [];
          acc.user.pendingTxHash = null;
          acc.user.depositSubmittedAt = null;
          acc.activePlans = [];
          acc.completedPlans = [];
          acc.transactions = [];
          acc.wallet = acc.wallet || {};
          acc.wallet.availableBalance = 0.00;
          acc.wallet.investedBalance = 0.00;
          acc.wallet.totalProfits = 0.00;
          acc.wallet.pendingWithdrawal = 0.00;
          acc.user.totalDeposited = 0.00;
          acc.user.referralCount = 0;
          acc.user.referralBypassed = false;
          acc.user.lastSpinTimestamp = 0;
          localStorage.setItem("cryptron_account_v3_countdown", JSON.stringify(acc));
        }
      }
    } catch (e) {}

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
          subject: "🎉 Withdrawals Unlocked!",
          body: `Hello ${user.name}, your account is now fully eligible to submit your $25.00 USDT payout request! Paste your personal USDT address to withdraw.`,
          priority: "success",
          category: "Withdrawal Status"
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
          sender: "CRYPTRONVEST Protocol Admin",
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
          sender: "CRYPTRONVEST Protocol Admin",
          targetType: "all_inactive",
          targetUserId: null,
          targetUserName: null,
          subject: "Welcome to CRYPTRONVEST - Activate Your $10 Contract",
          body: "Welcome to CRYPTRONVEST Protocol! Complete your initial $10.00 USDT deposit to activate your 7-day countdown to $25.00 and unlock your daily spin on the $10,000 Lucky Wheel.",
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
    window.dispatchEvent(new CustomEvent('cryptron_messages_updated'));
    window.dispatchEvent(new CustomEvent('cryptron_users_updated'));
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
      sender: "CRYPTRONVEST Protocol Admin",
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

