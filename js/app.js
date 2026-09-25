/**
 * CRYPTRON - 7-DAY CRYPTO YIELD & GAMIFIED SPIN ENGINE
 * Features:
 * 1. $10 -> $25 in 7 Days with real-time countdown (Days, Hours, Minutes, Seconds)
 * 2. Daily Spin the Wheel ($10,000 Grand Prize, requires active $10 investment, impossible $10k win rate)
 * 3. Withdrawal Lock: Requires at least 5 invited friends who spun the wheel
 */

// Default blank account state for new or unauthenticated users
const DEFAULT_ACCOUNT = {
  user: {
    name: "New Investor",
    email: "",
    tier: "Staker",
    walletAddress: "",
    promoCode: "",
    referralCode: "",
    referralCount: 0,
    requiredReferrals: 5,
    hasActiveInvestment: false,
    investmentStatus: "not_invested",
    lastSpinTimestamp: 0
  },
  wallet: {
    availableBalance: 0.00,
    investedBalance: 0.00,
    totalProfits: 0.00,
    pendingWithdrawal: 0.00,
    currency: "USDT"
  },
  activePlans: [],
  transactions: []
};

const STORAGE_KEY = "cryptron_account_v3_countdown";
const THEME_KEY = "cryptron_theme_preference";

function getAccountData() {
  if (window.UserDatabase) {
    const currentUserId = UserDatabase.getCurrentUserId();
    const dbUser = UserDatabase.getUserById(currentUserId);
    if (dbUser) {
      const stored = localStorage.getItem(STORAGE_KEY);
      let base;
      try {
        base = stored ? JSON.parse(stored) : JSON.parse(JSON.stringify(DEFAULT_ACCOUNT));
        // Isolate session to active dbUser: discard stored data if it belongs to a different user ID
        if (base.user && base.user.id && base.user.id !== dbUser.id) {
          base = JSON.parse(JSON.stringify(DEFAULT_ACCOUNT));
        }
      } catch(e) {
        base = JSON.parse(JSON.stringify(DEFAULT_ACCOUNT));
      }

      // Synchronize fields from dbUser
      base.user.id = dbUser.id;
      base.user.name = dbUser.name;
      base.user.email = dbUser.email;
      base.user.walletAddress = dbUser.walletAddress;
      base.user.promoCode = dbUser.promoCode || dbUser.referralCode || "DAVID8821";
      base.user.referralCode = base.user.promoCode;
      base.user.referralCount = dbUser.referralCount !== undefined ? dbUser.referralCount : 0;
      base.user.referralBypassed = !!dbUser.referralBypassed;
      base.user.investmentStatus = dbUser.investmentStatus || (dbUser.activePlans && dbUser.activePlans.length > 0 ? 'active' : 'not_invested');
      base.user.pendingTxHash = dbUser.pendingTxHash || null;
      
      // Isolate lastSpinTimestamp cleanly to dbUser only (default to 0 so fresh staker can spin on day countdown starts)
      base.user.lastSpinTimestamp = (dbUser.lastSpinTimestamp !== undefined && dbUser.lastSpinTimestamp !== null) 
        ? dbUser.lastSpinTimestamp 
        : 0;

      base.user.withdrawalRequest = dbUser.withdrawalRequest || null;
      base.user.withdrawalHistory = dbUser.withdrawalHistory || [];
      base.activePlans = dbUser.activePlans || [];

      // Ensure that if user is active, they have an active 7-day vault plan with a running countdown
      if (base.user.investmentStatus === 'active' && !base.user.withdrawalRequest && base.activePlans.length === 0) {
        const now = Date.now();
        const autoPlan = {
          id: "cryp-" + Math.floor(700 + Math.random() * 200),
          planName: "7-Day Crypto Yield Vault",
          principal: 10.00,
          totalPayout: 25.00,
          createdAt: now,
          maturityTimestamp: now + (7 * 86400000),
          durationDays: 7,
          status: "Active"
        };
        base.activePlans = [autoPlan];
        dbUser.activePlans = [autoPlan];
        base.user.lastSpinTimestamp = 0; // Fresh daily spin guaranteed on countdown start day!
        dbUser.lastSpinTimestamp = 0;
        try {
          const allU = UserDatabase.getAllUsers();
          const target = allU.find(u => u.id === dbUser.id);
          if (target) {
            target.activePlans = [autoPlan];
            target.investmentStatus = 'active';
            target.lastSpinTimestamp = 0;
            UserDatabase.saveUsers(allU);
          }
        } catch(e) {}
      }

      // If user has an active contract and lastSpinTimestamp was prior to or at contract start:
      // Client is guaranteed to be allowed to spin on the day their countdown starts!
      if (base.activePlans && base.activePlans.length > 0) {
        const primaryContract = base.activePlans[0];
        if (base.user.lastSpinTimestamp && primaryContract.createdAt && base.user.lastSpinTimestamp <= primaryContract.createdAt) {
          base.user.lastSpinTimestamp = 0;
          dbUser.lastSpinTimestamp = 0;
        }
      }

      base.user.hasActiveInvestment = (base.activePlans.length > 0) || (base.user.investmentStatus === 'active');
      
      const investedTotal = base.activePlans.reduce((sum, p) => sum + (p.principal || 10), 0);
      base.wallet.investedBalance = investedTotal;
      if (dbUser.availableBalance !== undefined) base.wallet.availableBalance = Number(dbUser.availableBalance) || 0.00;
      if (dbUser.pendingWithdrawal !== undefined) base.wallet.pendingWithdrawal = Number(dbUser.pendingWithdrawal) || 0.00;
      if (dbUser.totalProfits !== undefined) base.wallet.totalProfits = Number(dbUser.totalProfits) || 0.00;

      // RULE: When account is not invested (post-withdrawal settlement, account reset, or initial sign up):
      // EVERYTHING starts afresh with strictly $0.00 across all wallet metrics as if no transaction has been made on it at all!
      if (base.user.withdrawalRequest) {
        // While withdrawal is queued awaiting admin settlement, account resets as if no transaction has been made on it at all,
        // while preserving base.user.withdrawalRequest so both Client and Admin see the pending payout!
        base.activePlans = [];
        base.completedPlans = [];
        base.transactions = [];
        base.user.hasActiveInvestment = false;
        base.wallet.availableBalance = 0.00;
        base.wallet.investedBalance = 0.00;
        base.wallet.totalProfits = 0.00;
        base.wallet.pendingWithdrawal = 0.00;
        base.user.totalDeposited = 0.00;
        base.user.pendingTxHash = null;
        base.user.depositSubmittedAt = null;
      } else if (base.user.investmentStatus === 'pending_approval') {
        base.activePlans = [];
        base.completedPlans = [];
        base.user.hasActiveInvestment = false;
        base.wallet.availableBalance = 0.00;
        base.wallet.investedBalance = 0.00;
        base.wallet.totalProfits = 0.00;
        base.wallet.pendingWithdrawal = 0.00;
        base.user.totalDeposited = 0.00;
        base.user.withdrawalRequest = null;
      } else if (base.user.investmentStatus === 'not_invested' || (base.activePlans.length === 0 && base.user.investmentStatus !== 'active' && base.user.investmentStatus !== 'matured')) {
        base.activePlans = [];
        base.completedPlans = [];
        base.transactions = [];
        base.user.hasActiveInvestment = false;
        base.wallet.availableBalance = 0.00;
        base.wallet.investedBalance = 0.00;
        base.wallet.totalProfits = 0.00;
        base.wallet.pendingWithdrawal = 0.00;
        base.user.totalDeposited = 0.00;
        base.user.withdrawalRequest = null;
        base.user.withdrawalHistory = [];
        base.user.pendingTxHash = null;
        base.user.depositSubmittedAt = null;
      }

      return base;
    }
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_ACCOUNT));
    return DEFAULT_ACCOUNT;
  }
  try {
    const data = JSON.parse(stored);
    if (data.user && data.user.investmentStatus === 'not_invested') {
      data.activePlans = [];
      data.completedPlans = [];
      data.transactions = [];
      data.user.hasActiveInvestment = false;
      data.user.withdrawalRequest = data.user.withdrawalRequest || null;
      data.user.withdrawalHistory = [];
      data.user.pendingTxHash = null;
      data.user.depositSubmittedAt = null;
      data.wallet = data.wallet || {};
      data.wallet.availableBalance = 0.00;
      data.wallet.investedBalance = 0.00;
      data.wallet.totalProfits = 0.00;
      data.wallet.pendingWithdrawal = 0.00;
      data.user.totalDeposited = 0.00;
    } else if (data.user && (data.user.investmentStatus === 'active' || data.user.hasActiveInvestment) && (!data.activePlans || data.activePlans.length === 0)) {
      const now = Date.now();
      data.activePlans = [{
        id: "cryp-701",
        planName: "7-Day Crypto Yield Vault",
        principal: 10.00,
        totalPayout: 25.00,
        createdAt: now,
        maturityTimestamp: now + (7 * 86400000),
        durationDays: 7,
        status: "Active"
      }];
      data.user.lastSpinTimestamp = 0;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    // Ensure new properties exist
    if (!data.user.referralCount && data.user.referralCount !== 0) data.user.referralCount = 3;
    if (!data.user.requiredReferrals) data.user.requiredReferrals = 5;
    if (data.user.hasActiveInvestment === undefined) data.user.hasActiveInvestment = (data.activePlans && data.activePlans.length > 0);
    if (data.user.lastSpinTimestamp === undefined || data.user.lastSpinTimestamp === null) data.user.lastSpinTimestamp = 0;
    if (data.activePlans && data.activePlans.length > 0 && data.user.lastSpinTimestamp && data.activePlans[0].createdAt && data.user.lastSpinTimestamp <= data.activePlans[0].createdAt) {
      data.user.lastSpinTimestamp = 0;
    }
    return data;
  } catch (e) {
    console.error("Error parsing stored account data", e);
    return DEFAULT_ACCOUNT;
  }
}

function saveAccountData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  if (window.UserDatabase) {
    const currentUserId = UserDatabase.getCurrentUserId();
    const allUsers = UserDatabase.getAllUsers();
    let user = allUsers.find(u => u.id === currentUserId);
    if (user) {
      user.activePlans = data.activePlans || [];
      user.referralCount = data.user.referralCount || 0;
      if (data.user.referralBypassed !== undefined) user.referralBypassed = !!data.user.referralBypassed;
      user.investmentStatus = (user.activePlans.length > 0) ? 'active' : (data.user.investmentStatus || 'not_invested');
      user.pendingTxHash = data.user.pendingTxHash || null;
      user.lastSpinTimestamp = data.user.lastSpinTimestamp || 0;
      if (data.user.withdrawalRequest !== undefined) user.withdrawalRequest = data.user.withdrawalRequest;
      if (data.wallet) {
        user.availableBalance = data.wallet.availableBalance;
        user.totalProfits = data.wallet.totalProfits;
      }
      user.totalDeposited = user.activePlans.reduce((sum, p) => sum + (p.principal || 10), 0);
      UserDatabase.saveUsers(allUsers, { skipCloudPush: true });
      if (window.CloudSyncEngine && CloudSyncEngine.isConnected()) {
        CloudSyncEngine.pushUser(user).catch(console.warn);
      }
    } else if (data.user && data.user.id && data.user.email) {
      // Re-insert user into UserDatabase if not present
      const newUserObj = {
        id: data.user.id,
        name: data.user.name || "Client",
        email: data.user.email,
        password: "password123",
        passwordMasked: "••••••••",
        registeredAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        walletAddress: data.user.walletAddress || "0x...",
        referralCode: data.user.referralCode || `REF-${(data.user.id||'').replace(/\D/g, '') || '1004'}-8112`,
        referralCount: data.user.referralCount || 0,
        referralBypassed: !!data.user.referralBypassed,
        investmentStatus: (data.activePlans && data.activePlans.length > 0) ? 'active' : (data.user.investmentStatus || 'not_invested'),
        pendingTxHash: data.user.pendingTxHash || null,
        withdrawalRequest: data.user.withdrawalRequest || null,
        totalDeposited: (data.wallet && data.wallet.investedBalance) || 0,
        availableBalance: (data.wallet && data.wallet.availableBalance) || 0,
        totalProfits: (data.wallet && data.wallet.totalProfits) || 0,
        status: "Active",
        activePlans: data.activePlans || []
      };
      allUsers.unshift(newUserObj);
      UserDatabase.saveUsers(allUsers, { skipCloudPush: true });
      if (window.CloudSyncEngine && CloudSyncEngine.isConnected()) {
        CloudSyncEngine.pushUser(newUserObj).catch(console.warn);
      }
    }
  }
}

function formatUSD(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// Toast Alert System
function showToast(message, type = 'success') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const colors = {
    success: 'bg-emerald-950 border-emerald-500/50 text-emerald-300',
    error: 'bg-rose-950 border-rose-500/50 text-rose-300',
    info: 'bg-cyan-950 border-cyan-500/50 text-cyan-300',
    warning: 'bg-amber-950 border-amber-500/50 text-amber-300'
  };

  const icons = {
    success: `<svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`,
    error: `<svg class="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`,
    info: `<svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
    warning: `<svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`
  };

  toast.className = `pointer-events-auto flex items-center gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-300 transform translate-y-3 opacity-0 ${colors[type] || colors.info}`;
  toast.innerHTML = `
    <div class="flex-shrink-0">${icons[type] || icons.info}</div>
    <div class="text-sm font-medium text-slate-200">${message}</div>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => toast.classList.remove('translate-y-3', 'opacity-0'), 10);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// Deposit Submission: Requires Admin Verification with Tx Hash
function processDeposit(amount, method, txHash = null) {
  if (isNaN(amount) || amount <= 0) {
    showToast("Please enter a valid deposit amount.", "error");
    return false;
  }

  const account = getAccountData();
  const effectiveHash = (txHash && txHash.trim()) ? txHash.trim() : "Submitted $10 Deposit (Pending TxID)";

  // NOTE: Deposit does NOT reflect immediately in portfolio/balance until admin confirms transaction hash
  const newTx = {
    id: "TX-" + Math.floor(10000 + Math.random() * 90000),
    type: "Deposit",
    amount: amount,
    method: method || "USDT (Tether)",
    date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    status: "Pending Admin Confirmation",
    txHash: effectiveHash
  };

  account.transactions.unshift(newTx);
  account.user.investmentStatus = 'pending_approval';
  account.user.pendingTxHash = effectiveHash;
  saveAccountData(account);

  // Sync to UserDatabase if present
  if (window.UserDatabase && account.user && account.user.id) {
    try {
      UserDatabase.submitDepositConfirmation(account.user.id, effectiveHash);
    } catch(e) {
      console.warn("UserDatabase submitDepositConfirmation error:", e);
    }
  }

  showToast(`✅ Deposit submitted! Waiting for admin confirmation with transaction hash. Your portfolio will update once approved.`, "info");
  
  if (typeof updateDashboardUI === 'function') updateDashboardUI();
  return true;
}

/**
 * Withdrawal Function with Mandatory Active/Matured Contract Check
 */
function processWithdrawal(amount, method, address) {
  if (isNaN(amount) || amount <= 0) {
    showToast("Please enter a valid withdrawal amount.", "error");
    return false;
  }

  const account = getAccountData();

  // RULE CHECK: Must have an active or matured investment contract
  const hasActive = (account.activePlans && account.activePlans.length > 0) || (account.user && account.user.hasActiveInvestment) || (account.user && account.user.investmentStatus === 'matured');
  if (!hasActive) {
    showToast("Withdrawal unavailable: You must have an active or matured $10.00 USDT investment contract.", "warning");
    return false;
  }

  // MANDATORY RULE CHECK: Maximum withdrawal limit is $25.00 USDT
  if (amount > 25.00) {
    showToast("Maximum withdrawal amount is $25.00 USDT per request.", "error");
    return false;
  }

  // Destination USDT Address validation
  if (!address || address.trim().length < 6) {
    showToast("Please paste your valid USDT (Tether) receiving address.", "error");
    return false;
  }

  // MANDATORY RULE CHECK: Must have invited at least 5 friends who have spun the wheel (unless waived by Admin)
  const isBypassed = !!(account.user && account.user.referralBypassed);
  const invited = (account.user && account.user.referralCount !== undefined) ? account.user.referralCount : 0;
  const required = (account.user && account.user.requiredReferrals) || 5;
  if (!isBypassed && invited < required) {
    showToast(`🔒 Withdrawal Locked: You must have brought at least ${required} friends who spun the wheel before you can withdraw (${invited}/${required} completed).`, "error");
    return false;
  }

  if (amount > account.wallet.availableBalance) {
    showToast(`Insufficient balance! Available: ${formatUSD(account.wallet.availableBalance)}`, "error");
    return false;
  }

  // Synchronize to UserDatabase so Admin can view, inspect USDT address, and settle
  let submittedReq = null;
  if (window.UserDatabase && account.user && account.user.id) {
    try {
      submittedReq = UserDatabase.submitWithdrawalRequest(account.user.id, amount, address, method);
    } catch(err) {
      showToast(err.message, "error");
      return false;
    }
  }

  // RULE: After withdrawal and payout button has been hit, account has to reset as if no transaction has been made on it at all!
  account.wallet.availableBalance = 0.00;
  account.wallet.investedBalance = 0.00;
  account.wallet.totalProfits = 0.00;
  account.wallet.pendingWithdrawal = 0.00;
  account.completedPlans = [];
  account.activePlans = [];
  account.transactions = []; // Empty: as if no transaction has been made on it at all
  account.user.hasActiveInvestment = false;
  account.user.investmentStatus = 'pending_withdrawal'; // Tracks pending withdrawal for Admin while balances are 0.00
  account.user.totalDeposited = 0.00;
  account.user.pendingTxHash = null;
  account.user.depositSubmittedAt = null;
  account.user.withdrawalHistory = [];
  account.user.referralCount = 0; // Starts afresh for the next cycle
  account.user.referralBypassed = false;
  account.user.lastSpinTimestamp = 0;
  account.user.withdrawalRequest = submittedReq || {
    id: "WREQ-" + Math.floor(10000 + Math.random() * 90000),
    amount: amount,
    usdtAddress: address.trim(),
    network: method || "USDT (Tether)",
    status: "Pending Settlement",
    submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    _submittedTimestamp: Date.now()
  };

  saveAccountData(account);

  showToast(`✅ Withdrawal request of ${formatUSD(amount)} submitted! Your USDT Tether address has been registered for payout. Deposit $10 to start a new 7-day vault!`, "success");
  
  if (typeof updateDashboardUI === 'function') updateDashboardUI();
  return true;
}

/**
 * Invest in $10 -> $25 in 7 Days Contract with Exact 7-Day Countdown Timestamp
 */
function investInSevenDayPlan(units = 1) {
  const principal = units * 10;
  const totalPayout = units * 25;

  const account = getAccountData();
  if (principal > account.wallet.availableBalance) {
    showToast(`Insufficient balance! You need ${formatUSD(principal)} but have ${formatUSD(account.wallet.availableBalance)}. Please deposit $10 first.`, "error");
    return false;
  }

  account.wallet.availableBalance -= principal;
  account.wallet.investedBalance += principal;
  account.user.hasActiveInvestment = true;
  account.user.investmentStatus = "active";
  account.user.lastSpinTimestamp = 0; // Guaranteed free spin unlocked on countdown start day!

  // 7 Days in milliseconds = 7 * 24 * 60 * 60 * 1000 = 604,800,000 ms
  const maturityTime = Date.now() + (7 * 86400000);

  const newPlan = {
    id: "cryp-" + Math.floor(700 + Math.random() * 200),
    planName: `7-Day Crypto Yield Vault (${units}x)`,
    principal: principal,
    totalPayout: totalPayout,
    maturityTimestamp: maturityTime,
    createdAt: Date.now(),
    durationDays: 7,
    status: "Active"
  };

  const newTx = {
    id: "TX-" + Math.floor(10000 + Math.random() * 90000),
    type: "Investment",
    amount: principal,
    method: `7-Day Vault ($${principal} -> $${totalPayout})`,
    date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    status: "Completed",
    txHash: "0x" + Math.random().toString(16).substring(2, 28)
  };

  account.activePlans.unshift(newPlan);
  account.transactions.unshift(newTx);
  saveAccountData(account);

  showToast(`Staked ${formatUSD(principal)}! Countdown started: $${totalPayout} unlocks in exactly 7 days. Daily spin unlocked!`, "success");
  
  if (typeof updateDashboardUI === 'function') updateDashboardUI();
  return true;
}



/**
 * SPIN THE WHEEL ENGINE
 * 
 * Rules:
 * 1. User MUST have an active $10 investment plan to spin.
 * 2. Probability of winning $10,000 is IMPOSSIBLE (0%).
 * 3. Possible outcomes:
 *    - 🪙 $0.50 USDT (Common)
 *    - 💎 $1.00 USDT (Medium)
 *    - ⚡ $2.00 USDT (Rare)
 *    - 🎯 Try Again Tomorrow (Common)
 *    - 🎟️ +1 Free Spin Ticket (Medium)
 *    - 🌟 $0.25 USDT (Common)
 */
const WHEEL_PRIZES = [
  { id: 0, text: "$10,000 JACKPOT", color: "#fbbf24", payout: 10000, isJackpot: true }, // Segment 0: IMPOSSIBLE
  { id: 1, text: "$0.50 USDT", color: "#10b981", payout: 0.50, isJackpot: false },
  { id: 2, text: "TRY AGAIN", color: "#64748b", payout: 0.00, isJackpot: false },
  { id: 3, text: "$1.00 USDT", color: "#06b6d4", payout: 1.00, isJackpot: false },
  { id: 4, text: "+1 FREE SPIN", color: "#8b5cf6", payout: 0.00, isJackpot: false },
  { id: 5, text: "$0.25 USDT", color: "#10b981", payout: 0.25, isJackpot: false },
  { id: 6, text: "$2.00 USDT", color: "#3b82f6", payout: 2.00, isJackpot: false },
  { id: 7, text: "BETTER LUCK", color: "#475569", payout: 0.00, isJackpot: false }
];

// Available segments that can be won (excludes index 0 = $10,000)
const ALLOWED_WIN_INDICES = [1, 2, 3, 4, 5, 6, 7];

const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000; // Exactly 24 Hours in Milliseconds

/**
 * Check if the 7-day contract countdown has expired or matured ("spin ends after countdown")
 */
function isContractCountdownExpired(account) {
  if (!account) return false;
  // A contract is only expired/ended if the client has a matured status from a completed contract
  if (account.user && account.user.investmentStatus === 'matured') {
    return true;
  }
  const primaryPlan = (account.activePlans && account.activePlans.length > 0) ? account.activePlans[0] : null;
  if (primaryPlan) {
    if (primaryPlan.isMatured || (primaryPlan.maturityTimestamp && primaryPlan.maturityTimestamp <= Date.now())) {
      return true;
    }
  }
  return false;
}

/**
 * Universal Spin Status Checker
 * Handles:
 * 1. Unfunded state ($10 vault not active)
 * 2. Contract Expired state (7-day countdown ended -> daily spins end for this contract)
 * 3. 24-Hour Cooldown state (after each spin, exactly 24 hours until next spin)
 * 4. Ready state (Day 1 first spin or 24 hours have elapsed)
 */
function getSpinStatus(account) {
  if (!account) account = getAccountData();
  const isFunded = window.isClientFundedAndActive ? isClientFundedAndActive(account) : 
    ((account.activePlans && account.activePlans.length > 0) || (account.user && (account.user.investmentStatus === 'active' || account.user.hasActiveInvestment)));

  // State 1: Not funded
  if (!isFunded) {
    return {
      canSpin: false,
      reason: 'not_funded',
      badgeText: 'PARTICIPATE',
      message: 'Deposit to spin and stand a chance to win $10,000',
      cooldownRemainingMs: 0,
      hours: "00",
      minutes: "00",
      seconds: "00",
      formattedTime: '00h 00m 00s'
    };
  }

  // State 2: 7-Day contract countdown completed ("spin ends after countdown")
  if (isContractCountdownExpired(account)) {
    return {
      canSpin: false,
      reason: 'contract_expired',
      badgeText: 'SPINS ENDED',
      message: '7-Day countdown completed. Daily spins have ended for this contract. Claim your $25 payout!',
      cooldownRemainingMs: 0,
      hours: "00",
      minutes: "00",
      seconds: "00",
      formattedTime: '00h 00m 00s'
    };
  }

  // State 3: Active 7-day countdown running - check 24h cooldown
  const primaryPlan = (account.activePlans && account.activePlans.length > 0) ? account.activePlans[0] : null;
  const contractCreatedAt = primaryPlan ? primaryPlan.createdAt : 0;
  const lastSpin = account.user ? (account.user.lastSpinTimestamp || 0) : 0;

  // First spin: if user has never spun, or last spin was before/at the moment this contract started
  if (!lastSpin || lastSpin <= 0 || (contractCreatedAt && lastSpin <= contractCreatedAt)) {
    return {
      canSpin: true,
      reason: 'ready',
      badgeText: 'SPIN READY',
      message: 'Active $10 Investment Verified • Spin Ready!',
      cooldownRemainingMs: 0,
      hours: "00",
      minutes: "00",
      seconds: "00",
      formattedTime: '00h 00m 00s'
    };
  }

  // Calculate remaining time in 24-hour cooldown
  const elapsed = Date.now() - lastSpin;
  const remaining = SPIN_COOLDOWN_MS - elapsed;

  if (remaining > 0) {
    const totalSec = Math.ceil(remaining / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const pad = n => String(n).padStart(2, '0');
    const formatted = `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;

    return {
      canSpin: false,
      reason: 'cooldown',
      badgeText: '24H COOLDOWN',
      cooldownRemainingMs: remaining,
      hours: pad(hours),
      minutes: pad(minutes),
      seconds: pad(seconds),
      formattedTime: formatted,
      message: `Next free spin unlocks in ${formatted} (24-hour cooldown between spins).`
    };
  }

  // 24 hours have elapsed since previous spin!
  return {
    canSpin: true,
    reason: 'ready',
    badgeText: 'SPIN READY',
    message: '24 hours elapsed! Your next spin is ready. Spin for up to $10,000!',
    cooldownRemainingMs: 0,
    hours: "00",
    minutes: "00",
    seconds: "00",
    formattedTime: '00h 00m 00s'
  };
}

/**
 * 24-Hour Cooldown check
 */
function hasUserSpunToday(timestamp, contractCreatedAt) {
  if (!timestamp || timestamp <= 0) return false;
  if (contractCreatedAt && timestamp <= contractCreatedAt) return false;
  return (Date.now() - timestamp) < SPIN_COOLDOWN_MS;
}

/**
 * Calculates remaining time until next spin unlocks (24h cooldown)
 */
function getTimeUntilNextSpin(account) {
  const status = getSpinStatus(account);
  if (status.reason === 'cooldown') {
    return {
      hours: status.hours,
      minutes: status.minutes,
      seconds: status.seconds,
      diff: status.cooldownRemainingMs,
      text: status.formattedTime
    };
  }
  return { hours: "00", minutes: "00", seconds: "00", diff: 0, text: "00h 00m 00s" };
}

function getTimeUntilTomorrow() {
  return getTimeUntilNextSpin();
}



/**
 * Comprehensive check to verify if a client has funded and countdown is on
 */
function isClientFundedAndActive(account) {
  if (!account) return false;
  if (account.activePlans && account.activePlans.length > 0) return true;
  if (account.user) {
    if (account.user.investmentStatus === 'active' || account.user.hasActiveInvestment) return true;
    if (account.user.activePlans && account.user.activePlans.length > 0) return true;
  }
  if (window.UserDatabase) {
    const currentId = UserDatabase.getCurrentUserId();
    const u = currentId ? UserDatabase.getUserById(currentId) : null;
    if (u && (u.investmentStatus === 'active' || (u.activePlans && u.activePlans.length > 0))) return true;
  }
  return false;
}

let isSpinning = false;
let currentWheelRotation = 0;

function executeSpin(wheelCanvasId = 'wheelCanvas', resultCallback) {
  if (isSpinning) return;

  const account = getAccountData();
  const status = getSpinStatus(account);

  // Check 1: Must have invested in the $10 plan
  if (status.reason === 'not_funded') {
    if (typeof openVerifiedInvestorModal === 'function') openVerifiedInvestorModal();
    showToast("🔒 Wheel is Locked! You must deposit and activate the $10 vault before you can spin the wheel.", "warning");
    return;
  }

  // Check 2: 7-Day contract countdown completed ("spin ends after countdown")
  if (status.reason === 'contract_expired') {
    showToast("🏁 7-Day contract countdown has completed! Daily spins have ended for this contract. Claim your $25 payout or start a new $10 contract to unlock spins.", "info");
    return;
  }

  // Check 3: 24-Hour cooldown between spins
  if (status.reason === 'cooldown') {
    showToast(`⏳ Please wait! Next free spin unlocks in ${status.formattedTime} (24 hours between spins).`, "warning");
    return;
  }

  const canvas = document.getElementById(wheelCanvasId);
  if (!canvas) return;

  isSpinning = true;

  // Pick a random prize from ALLOWED segments (Index 0 [$10,000] is NEVER picked)
  const winningPrizeIndex = ALLOWED_WIN_INDICES[Math.floor(Math.random() * ALLOWED_WIN_INDICES.length)];
  const prize = WHEEL_PRIZES[winningPrizeIndex];

  // 8 segments of 45 degrees
  // Index 0 starts at 0 deg (3 o'clock) and goes clockwise
  // Arrow pointer is at the TOP (270 deg or -90 deg)
  const segmentAngle = 360 / WHEEL_PRIZES.length; // 45 deg
  const segmentCenter = (winningPrizeIndex * segmentAngle) + (segmentAngle / 2);
  const targetStop = (270 - segmentCenter + 360) % 360;

  // Add 5 to 7 full revolutions for exciting spin
  const extraRotations = 360 * (5 + Math.floor(Math.random() * 3));
  const currentMod = currentWheelRotation % 360;
  const delta = ((targetStop - currentMod) + 360) % 360;
  currentWheelRotation += extraRotations + delta;

  // Perform physical wheel rotation
  canvas.style.transition = 'transform 4.8s cubic-bezier(0.12, 0.85, 0.22, 1)';
  canvas.style.transform = `rotate(${currentWheelRotation}deg)`;

  const spinBtn = document.getElementById('spin-btn');
  if (spinBtn) {
    spinBtn.disabled = true;
    spinBtn.classList.add('opacity-80');
    spinBtn.innerHTML = `<span>🌀 SPINNING THE WHEEL...</span>`;
  }

  // After animation finishes (5s), resolve prize
  setTimeout(() => {
    isSpinning = false;
    
    // Record spin timestamp to begin the 24-hour cooldown for the next spin
    account.user.lastSpinTimestamp = Date.now();

    // Record user spin in UserDatabase to credit their inviter if this referral spins for the first time
    if (window.UserDatabase && account.user && account.user.id) {
      try {
        UserDatabase.recordUserSpin(account.user.id);
      } catch(e) {}
    }

    if (prize.payout > 0) {
      account.wallet.availableBalance = (account.wallet.availableBalance || 0) + prize.payout;
      account.transactions.unshift({
        id: "TX-SPIN-" + Math.floor(1000 + Math.random() * 9000),
        type: "Daily Spin Win",
        amount: prize.payout,
        method: "Lucky Wheel Reward",
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: "Completed",
        txHash: "0xSPIN" + Math.random().toString(16).substring(2, 10)
      });
      saveAccountData(account);
      showToast(`🎉 You won ${formatUSD(prize.payout)} from the Lucky Wheel! Added to wallet. Next free spin unlocks in 24 hours.`, "success");
    } else {
      saveAccountData(account);
      showToast(`🎯 The wheel landed on: "${prize.text}"! Next free spin unlocks in 24 hours.`, "info");
    }

    if (spinBtn) {
      spinBtn.disabled = false;
      spinBtn.classList.remove('opacity-80');
      spinBtn.innerHTML = `<span>🎰 SPIN FOR $10,000</span>`;
    }

    if (typeof updateDashboardUI === 'function') updateDashboardUI();
    if (typeof resultCallback === 'function') resultCallback(prize);
  }, 5000);
}

/**
 * Draw Wheel of Fortune onto an HTML5 Canvas
 */
function drawWheel(canvasId = 'wheelCanvas') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const radius = width / 2;
  const numSlices = WHEEL_PRIZES.length;
  const arcSize = (2 * Math.PI) / numSlices;

  ctx.clearRect(0, 0, width, height);

  WHEEL_PRIZES.forEach((slice, i) => {
    const angle = i * arcSize;
    ctx.beginPath();
    ctx.fillStyle = slice.color;
    ctx.moveTo(radius, radius);
    ctx.arc(radius, radius, radius - 8, angle, angle + arcSize);
    ctx.lineTo(radius, radius);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#080d1a';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Text label
    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(angle + arcSize / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = slice.id === 0 ? '#0f172a' : '#ffffff';
    ctx.font = slice.id === 0 ? 'bold 13px Plus Jakarta Sans' : 'bold 12px Plus Jakarta Sans';
    ctx.fillText(slice.text, radius - 20, 5);
    ctx.restore();
  });

  // Center hub pin
  ctx.beginPath();
  ctx.arc(radius, radius, 22, 0, 2 * Math.PI);
  ctx.fillStyle = '#080d1a';
  ctx.fill();
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(radius, radius, 8, 0, 2 * Math.PI);
  ctx.fillStyle = '#10b981';
  ctx.fill();
}

/**
 * Format Countdown String: "06d : 22h : 41m : 15s"
 */
function formatCountdown(targetTimestamp) {
  const now = Date.now();
  const diff = targetTimestamp - now;

  if (diff <= 0) {
    return {
      expired: true,
      text: "00d : 00h : 00m : 00s",
      days: "00", hours: "00", minutes: "00", seconds: "00"
    };
  }

  const seconds = Math.floor((diff / 1000) % 60);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  const pad = (n) => String(n).padStart(2, '0');

  return {
    expired: false,
    text: `${pad(days)}d : ${pad(hours)}h : ${pad(minutes)}m : ${pad(seconds)}s`,
    days: pad(days),
    hours: pad(hours),
    minutes: pad(minutes),
    seconds: pad(seconds)
  };
}

function initTheme() {
  const currentTheme = localStorage.getItem(THEME_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  
  const toggleButtons = document.querySelectorAll('.theme-toggle-btn');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const active = document.documentElement.getAttribute('data-theme');
      const nextTheme = active === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem(THEME_KEY, nextTheme);
      showToast(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode`, 'info');
    });
  });
}

function initMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const menuDrawer = document.getElementById('mobile-menu-drawer');
  const closeBtn = document.getElementById('mobile-menu-close');

  if (menuBtn && menuDrawer) {
    menuBtn.addEventListener('click', () => {
      menuDrawer.classList.toggle('hidden');
    });
  }

  if (closeBtn && menuDrawer) {
    closeBtn.addEventListener('click', () => {
      menuDrawer.classList.add('hidden');
    });
  }
}

function handleClientLogout() {
  if (window.UserDatabase) {
    UserDatabase.logout();
  } else {
    localStorage.removeItem('cryptron_current_user_id');
  }
  showToast("Logged out successfully.", "info");
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 400);
}

function getPromoCode(userOrCode) {
  if (!userOrCode) return "DAVID8821";
  if (typeof userOrCode === "string") return userOrCode;
  return userOrCode.promoCode || userOrCode.referralCode || "DAVID8821";
}

function getReferralLink(code) {
  return code || "DAVID8821";
}

function initAdminClientViewBar() {
  try {
    const path = (window.location.pathname || '').toLowerCase();
    if (path.includes('admin.html')) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('adminView') === '1') {
      sessionStorage.setItem('cryptron_admin_authenticated', 'true');
    }

    const isAdmin = sessionStorage.getItem('cryptron_admin_authenticated') === 'true';
    if (!isAdmin || !window.UserDatabase) return;

    const currentUserId = UserDatabase.getCurrentUserId();
    const allUsers = UserDatabase.getAllUsers();
    const activeUser = UserDatabase.getUserById(currentUserId) || allUsers[0];
    if (!activeUser) return;

    const existingBar = document.getElementById('admin-client-preview-bar');
    if (existingBar) existingBar.remove();

    const bar = document.createElement('div');
    bar.id = 'admin-client-preview-bar';
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:rgba(4,8,18,0.96);backdrop-filter:blur(12px);border-top:2px solid #10b981;padding:10px 16px;box-shadow:0 -10px 30px rgba(0,0,0,0.8);font-family:monospace;';

    const pages = [
      { label: '📊 Dashboard', file: 'dashboard.html' },
      { label: '🎡 Spin Wheel', file: 'spin.html' },
      { label: '📈 Vault Plans', file: 'plans.html' },
      { label: '🧾 Transactions', file: 'transactions.html' },
      { label: '🌐 Markets', file: 'markets.html' },
      { label: '🏠 Home', file: 'index.html' }
    ];

    const userOptions = allUsers.map(u => {
      const sel = u.id === activeUser.id ? 'selected' : '';
      return `<option value="${u.id}" ${sel}>${u.name} (${u.id}) - ${u.email}</option>`;
    }).join('');

    const pageLinks = pages.map(p => {
      const isCurrent = path.endsWith(p.file) || (p.file === 'index.html' && (path === '/' || path.endsWith('/')));
      const btnStyle = isCurrent
        ? 'background:#10b981;color:#020617;font-weight:900;border:1px solid #34d399;'
        : 'background:rgba(255,255,255,0.07);color:#e2e8f0;border:1px solid rgba(255,255,255,0.15);';
      return `<a href="${p.file}?userId=${encodeURIComponent(activeUser.id)}&adminView=1" style="${btnStyle}padding:6px 10px;border-radius:8px;font-size:11px;text-decoration:none;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;">${p.label}</a>`;
    }).join('');

    bar.innerHTML = `
      <div style="max-width:1280px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="background:rgba(16,185,129,0.2);color:#34d399;border:1px solid rgba(16,185,129,0.4);padding:4px 8px;border-radius:6px;font-size:11px;font-weight:bold;">🛡️ ADMIN CLIENT VIEW</span>
          <select id="admin-bar-client-select" style="background:#0f172a;color:#38bdf8;border:1px solid rgba(56,189,248,0.4);border-radius:8px;padding:5px 10px;font-size:11px;font-weight:bold;max-width:260px;outline:none;">
            ${userOptions}
          </select>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;overflow-x:auto;">
          ${pageLinks}
          <a href="admin.html" style="background:#f59e0b;color:#020617;font-weight:900;padding:6px 12px;border-radius:8px;font-size:11px;text-decoration:none;white-space:nowrap;margin-left:4px;">← Back to Admin Portal</a>
        </div>
      </div>
    `;

    document.body.style.paddingBottom = '68px';
    document.body.appendChild(bar);

    const selEl = document.getElementById('admin-bar-client-select');
    if (selEl) {
      selEl.addEventListener('change', (e) => {
        const nextId = e.target.value;
        if (nextId) {
          UserDatabase.setCurrentUserId(nextId);
          const currentFile = pages.find(p => path.endsWith(p.file))?.file || 'dashboard.html';
          window.location.href = `${currentFile}?userId=${encodeURIComponent(nextId)}&adminView=1`;
        }
      });
    }
  } catch (e) {
    console.warn('Admin client preview bar error:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileMenu();
  initAdminClientViewBar();
});

window.executeSpin = executeSpin;
window.drawWheel = drawWheel;
window.formatCountdown = formatCountdown;
window.hasUserSpunToday = hasUserSpunToday;
window.getTimeUntilTomorrow = getTimeUntilTomorrow;
window.getTimeUntilNextSpin = getTimeUntilNextSpin;
window.getSpinStatus = getSpinStatus;
window.isContractCountdownExpired = isContractCountdownExpired;
window.SPIN_COOLDOWN_MS = SPIN_COOLDOWN_MS;
window.handleClientLogout = handleClientLogout;
window.getReferralLink = getReferralLink;
window.getPromoCode = getPromoCode;
window.isClientFundedAndActive = isClientFundedAndActive;
window.initAdminClientViewBar = initAdminClientViewBar;


