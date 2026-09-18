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
      } catch(e) {
        base = JSON.parse(JSON.stringify(DEFAULT_ACCOUNT));
      }

      // Synchronize fields from dbUser
      base.user.id = dbUser.id;
      base.user.name = dbUser.name;
      base.user.email = dbUser.email;
      base.user.walletAddress = dbUser.walletAddress;
      base.user.referralCode = dbUser.referralCode;
      base.user.referralCount = dbUser.referralCount !== undefined ? dbUser.referralCount : 0;
      base.user.referralBypassed = !!dbUser.referralBypassed;
      base.user.investmentStatus = dbUser.investmentStatus || (dbUser.activePlans && dbUser.activePlans.length > 0 ? 'active' : 'not_invested');
      base.user.pendingTxHash = dbUser.pendingTxHash || null;
      base.user.lastSpinTimestamp = (dbUser.lastSpinTimestamp !== undefined) ? dbUser.lastSpinTimestamp : (base.user.lastSpinTimestamp || 0);
      base.user.withdrawalRequest = dbUser.withdrawalRequest || null;
      base.user.withdrawalHistory = dbUser.withdrawalHistory || [];
      base.activePlans = dbUser.activePlans || [];
      base.user.hasActiveInvestment = (base.activePlans.length > 0);
      
      const investedTotal = base.activePlans.reduce((sum, p) => sum + (p.principal || 10), 0);
      base.wallet.investedBalance = investedTotal;
      if (dbUser.availableBalance !== undefined) base.wallet.availableBalance = dbUser.availableBalance;
      if (dbUser.pendingWithdrawal !== undefined) base.wallet.pendingWithdrawal = dbUser.pendingWithdrawal;
      if (dbUser.totalProfits !== undefined) base.wallet.totalProfits = dbUser.totalProfits;

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
    // Ensure new properties exist
    if (!data.user.referralCount && data.user.referralCount !== 0) data.user.referralCount = 3;
    if (!data.user.requiredReferrals) data.user.requiredReferrals = 5;
    if (data.user.hasActiveInvestment === undefined) data.user.hasActiveInvestment = (data.activePlans && data.activePlans.length > 0);
    if (data.user.lastSpinTimestamp === undefined) data.user.lastSpinTimestamp = 0;
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
      UserDatabase.saveUsers(allUsers);
    } else if (data.user && data.user.id && data.user.email) {
      // Re-insert user into UserDatabase if not present
      allUsers.unshift({
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
      });
      UserDatabase.saveUsers(allUsers);
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
  const effectiveHash = (txHash && txHash.trim().length >= 4) ? txHash.trim() : "Submitted $10 Deposit (Pending TxID)";

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
  if (window.UserDatabase && account.user && account.user.id) {
    try {
      UserDatabase.submitWithdrawalRequest(account.user.id, amount, address, method);
    } catch(err) {
      showToast(err.message, "error");
      return false;
    }
  }

  // RULE: After withdrawal, everything starts afresh!
  // Client must deposit another $10 to start a new vault; active contract is concluded & wheel is locked
  account.wallet.availableBalance = 0.00;
  account.wallet.investedBalance = 0.00;
  account.wallet.pendingWithdrawal = (account.wallet.pendingWithdrawal || 0) + amount;
  account.completedPlans = account.completedPlans || [];
  if (account.activePlans && account.activePlans.length > 0) {
    account.completedPlans.unshift(...account.activePlans);
  }
  account.activePlans = [];
  account.user.hasActiveInvestment = false;
  account.user.investmentStatus = 'not_invested'; // Fresh state awaiting next $10 deposit
  account.user.referralCount = 0; // Starts afresh for the next cycle
  account.user.referralBypassed = false;
  account.user.withdrawalRequest = {
    amount: amount,
    usdtAddress: address.trim(),
    network: method || "USDT (Tether)",
    status: "Pending Settlement",
    submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
  };

  const newTx = {
    id: "TX-" + Math.floor(10000 + Math.random() * 90000),
    type: "Withdrawal",
    amount: amount,
    method: method || "USDT (Tether)",
    date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    status: "Pending Payout",
    txHash: "CRYP-" + Math.random().toString(16).substring(2, 10).toUpperCase(),
    destAddress: address.trim()
  };

  account.transactions.unshift(newTx);
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

/**
 * Daily Spin cooldown check: verifies if user has spun on current calendar day
 */
function hasUserSpunToday(timestamp) {
  if (!timestamp) return false;
  const spinDate = new Date(timestamp);
  const today = new Date();
  return spinDate.getFullYear() === today.getFullYear() &&
         spinDate.getMonth() === today.getMonth() &&
         spinDate.getDate() === today.getDate();
}

/**
 * Calculates hours and minutes remaining until next calendar day midnight
 */
function getTimeUntilTomorrow() {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  const diff = Math.max(0, tomorrow - now);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { hours, minutes, seconds, diff };
}



function executeSpin(wheelCanvasId = 'wheelCanvas', resultCallback) {
  const account = getAccountData();

  // Prerequisite 1: Must have invested in the $10 plan
  const hasActivePlan = account.activePlans && account.activePlans.length > 0;
  if (!hasActivePlan) {
    showToast("🔒 Wheel is Locked! You must deposit and activate the $10 vault before you can spin the wheel.", "warning");
    return;
  }

  // Prerequisite 2: Only 1 spin per day (blocked until tomorrow)
  if (hasUserSpunToday(account.user.lastSpinTimestamp)) {
    const cd = getTimeUntilTomorrow();
    showToast(`⏳ Daily spin limit reached! Your next free spin unlocks tomorrow (in ${cd.hours}h ${cd.minutes}m).`, "warning");
    return;
  }

  if (isSpinning) return;
  isSpinning = true;

  // Pick a random prize from ALLOWED segments (Index 0 [$10,000] is NEVER picked)
  const winningPrizeIndex = ALLOWED_WIN_INDICES[Math.floor(Math.random() * ALLOWED_WIN_INDICES.length)];
  const prize = WHEEL_PRIZES[winningPrizeIndex];

  // Calculate target rotation angle
  const segmentAngle = 360 / WHEEL_PRIZES.length;
  const extraRotations = 360 * 6;
  const targetDegree = extraRotations + (360 - (winningPrizeIndex * segmentAngle + segmentAngle / 2));

  const canvas = document.getElementById(wheelCanvasId);
  if (canvas) {
    canvas.style.transition = 'transform 5s cubic-bezier(0.15, 0.9, 0.25, 1)';
    canvas.style.transform = `rotate(${targetDegree}deg)`;
  }

  // After 5.2s, resolve spin
  setTimeout(() => {
    isSpinning = false;
    
    // Record spin timestamp so user cannot spin again until tomorrow
    account.user.lastSpinTimestamp = Date.now();

    // Record user spin in UserDatabase to credit their inviter if this referral spins for the first time
    if (window.UserDatabase && account.user && account.user.id) {
      UserDatabase.recordUserSpin(account.user.id);
    }

    if (prize.payout > 0) {
      account.wallet.availableBalance += prize.payout;
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
      showToast(`🎉 You won ${formatUSD(prize.payout)} from the Daily Spin! Added to wallet. Next spin unlocks tomorrow.`, "success");
    } else {
      saveAccountData(account);
      showToast(`You landed on: "${prize.text}". Come back tomorrow for your next free spin!`, "info");
    }

    if (canvas) {
      // Normalize rotation without visual jump
      const normalizedDegree = targetDegree % 360;
      canvas.style.transition = 'none';
      canvas.style.transform = `rotate(${normalizedDegree}deg)`;
    }

    if (typeof updateDashboardUI === 'function') updateDashboardUI();
    if (typeof resultCallback === 'function') resultCallback(prize);
  }, 5300);
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
      days: 0, hours: 0, minutes: 0, seconds: 0
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

function getReferralLink(code) {
  if (!code) code = "REF-1001-8821";
  const origin = window.location.origin;
  const path = window.location.pathname;
  if (origin && origin !== "null" && origin !== "file://") {
    const basePath = path.substring(0, path.lastIndexOf('/') + 1);
    return `${origin}${basePath}login.html?tab=signup&ref=${encodeURIComponent(code)}`;
  } else {
    return `login.html?tab=signup&ref=${encodeURIComponent(code)}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileMenu();
});

window.executeSpin = executeSpin;
window.drawWheel = drawWheel;
window.formatCountdown = formatCountdown;
window.hasUserSpunToday = hasUserSpunToday;
window.getTimeUntilTomorrow = getTimeUntilTomorrow;
window.handleClientLogout = handleClientLogout;
window.getReferralLink = getReferralLink;

