/**
 * CRYPTRON - Dynamic Full-Stack Backend Server
 * Real-time REST API & Persistent Database Engine
 * Compatible with Local execution (Node.js) & Cloud Platforms (Render, Railway, Vercel, Fly.io)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database storage setup
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'cryptron_database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial seed users fallback
const DEFAULT_SEED_USERS = [
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
    referralBypassed: false,
    investmentStatus: "active",
    pendingTxHash: null,
    withdrawalRequest: null,
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
        maturityTimestamp: Date.now() + (5 * 86400000),
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
    referralBypassed: false,
    investmentStatus: "pending_approval",
    pendingTxHash: "0x4a9b2c89e1f02c4b81a77e90c5d61",
    withdrawalRequest: null,
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
    referralBypassed: false,
    investmentStatus: "not_invested",
    pendingTxHash: null,
    withdrawalRequest: null,
    totalDeposited: 0.00,
    availableBalance: 0.00,
    totalProfits: 0.00,
    status: "Active",
    activePlans: []
  }
];

// In-Memory Database Store with Atomic Persistence
class DatabaseStore {
  constructor() {
    this.users = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.users)) {
          this.users = data.users;
          return;
        }
      }
    } catch (e) {
      console.warn("Could not load existing database file, initializing defaults:", e.message);
    }
    this.users = JSON.parse(JSON.stringify(DEFAULT_SEED_USERS));
    this.save();
  }

  save() {
    try {
      const payload = {
        users: this.users,
        meta: {
          version: "2.0.0",
          updatedAt: new Date().toISOString(),
          totalUsers: this.users.length
        }
      };
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (e) {
      console.error("Failed to persist database file:", e.message);
    }
  }

  getAll() {
    return this.users;
  }

  getById(id) {
    if (!id) return null;
    return this.users.find(u => u.id === id || u.email.toLowerCase() === id.toLowerCase()) || null;
  }

  getByReferralCode(code) {
    if (!code) return null;
    const clean = code.trim().toLowerCase();
    return this.users.find(u => (u.referralCode && u.referralCode.toLowerCase() === clean)) || null;
  }

  create(userData) {
    // Generate unique numeric ID
    let maxNum = 1000;
    this.users.forEach(u => {
      if (u.id) {
        const num = parseInt(u.id.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum + 1;
    const userId = `USR-${nextNum}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const referralCode = `REF-${nextNum}-${randomSuffix}`;

    const newUser = {
      id: userId,
      name: userData.name || "Cryptron Investor",
      email: userData.email,
      password: userData.password || "password123",
      passwordMasked: "••••••••",
      registeredAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      walletAddress: userData.walletAddress || "0x...",
      referralCode: referralCode,
      referralCount: 0,
      referralBypassed: false,
      referredBy: userData.referredBy || null,
      investmentStatus: "not_invested",
      pendingTxHash: null,
      withdrawalRequest: null,
      totalDeposited: 0.00,
      availableBalance: 0.00,
      totalProfits: 0.00,
      status: "Active",
      activePlans: [],
      ...userData,
      id: userId, // enforce generated id
      referralCode: referralCode
    };

    this.users.unshift(newUser);
    this.save();
    return newUser;
  }

  update(id, updates) {
    const idx = this.users.findIndex(u => u.id === id || u.email.toLowerCase() === id.toLowerCase());
    if (idx === -1) return null;

    this.users[idx] = {
      ...this.users[idx],
      ...updates
    };
    this.save();
    return this.users[idx];
  }

  merge(remoteUsers) {
    if (!Array.isArray(remoteUsers)) return this.users;
    const map = new Map();
    this.users.forEach(u => { if (u && u.id) map.set(u.id, u); });

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

    this.users = Array.from(map.values());
    this.save();
    return this.users;
  }
}

const db = new DatabaseStore();

/* -------------------------------------------------------------
 * REST API ENDPOINTS
 * ------------------------------------------------------------- */

// Health & Status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'dynamic',
    version: '2.0.0',
    usersCount: db.getAll().length,
    timestamp: new Date().toISOString()
  });
});

// Get Platform Stats
app.get('/api/stats', (req, res) => {
  const users = db.getAll();
  const activeUsers = users.filter(u => u.investmentStatus === 'active');
  const pendingDeposits = users.filter(u => u.investmentStatus === 'pending_approval');
  const pendingWithdrawals = users.filter(u => u.withdrawalRequest && u.withdrawalRequest.status === 'pending_admin');

  res.json({
    totalUsers: users.length,
    activeInvestors: activeUsers.length,
    pendingDeposits: pendingDeposits.length,
    pendingWithdrawals: pendingWithdrawals.length,
    totalVolume: activeUsers.reduce((sum, u) => sum + (u.totalDeposited || 0), 0)
  });
});

// Get All Users (Admin & Synchronization)
app.get('/api/users', (req, res) => {
  res.json({
    success: true,
    users: db.getAll()
  });
});

// Get User by ID or Email
app.get('/api/users/:id', (req, res) => {
  const user = db.getById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  res.json({ success: true, user });
});

// Authentication: Register
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, walletAddress, referralCode, referredBy } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const existing = db.getById(email);
  if (existing) {
    return res.status(400).json({ success: false, message: 'An account with this email already exists' });
  }

  const refInput = referralCode || referredBy || null;
  const newUser = db.create({
    name: name || 'Cryptron Client',
    email: email.trim().toLowerCase(),
    password: password,
    walletAddress: walletAddress || '0x...',
    referredBy: refInput
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    user: newUser
  });
});

// Authentication: Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const user = db.getById(email.trim().toLowerCase());
  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  res.json({
    success: true,
    message: 'Login successful',
    user
  });
});

// Submit $10 Vault Deposit Hash
app.post('/api/users/:id/deposit', (req, res) => {
  const { txHash, amount, address } = req.body;
  const user = db.getById(req.params.id);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (!txHash) {
    return res.status(400).json({ success: false, message: 'Transaction hash is required' });
  }

  const updated = db.update(user.id, {
    pendingTxHash: txHash.trim(),
    investmentStatus: 'pending_approval'
  });

  res.json({
    success: true,
    message: 'Deposit transaction hash registered with Cryptron for activation',
    user: updated
  });
});

// Admin: Activate $10 Yield Vault
app.post('/api/users/:id/activate', (req, res) => {
  const user = db.getById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const newPlan = {
    id: `cryp-${Date.now()}`,
    planName: '7-Day Crypto Yield Vault',
    principal: 10.00,
    totalPayout: 25.00,
    maturityTimestamp: Date.now() + (7 * 86400000),
    createdAt: Date.now(),
    durationDays: 7,
    status: 'Active'
  };

  const existingPlans = Array.isArray(user.activePlans) ? user.activePlans : [];
  const updated = db.update(user.id, {
    investmentStatus: 'active',
    pendingTxHash: null,
    totalDeposited: (user.totalDeposited || 0) + 10.00,
    activePlans: [newPlan, ...existingPlans]
  });

  res.json({
    success: true,
    message: 'Vault plan activated successfully',
    user: updated
  });
});

// Admin: Reject Deposit
app.post('/api/users/:id/reject-deposit', (req, res) => {
  const user = db.getById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const updated = db.update(user.id, {
    investmentStatus: 'not_invested',
    pendingTxHash: null
  });

  res.json({
    success: true,
    message: 'Deposit hash rejected',
    user: updated
  });
});

// Wheel Spin & Referral Trigger
app.post('/api/users/:id/spin', (req, res) => {
  const user = db.getById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Must have active $10 vault to spin
  if (user.investmentStatus !== 'active') {
    return res.status(403).json({
      success: false,
      message: 'Verified Investors Only: You must activate your $10 yield vault before you can spin the wheel.'
    });
  }

  let inviterCredited = false;
  let inviterId = null;

  // If first time spinning, credit the inviter +1 referral
  if (!user.referralSpinCredited) {
    user.referralSpinCredited = true;

    if (user.referredBy) {
      const inviter = db.getByReferralCode(user.referredBy) || db.getById(user.referredBy);
      if (inviter && inviter.id !== user.id) {
        db.update(inviter.id, {
          referralCount: (inviter.referralCount || 0) + 1
        });
        inviterCredited = true;
        inviterId = inviter.id;
      }
    }
  }

  const updatedUser = db.update(user.id, {
    lastSpinTimestamp: Date.now(),
    referralSpinCredited: user.referralSpinCredited
  });

  res.json({
    success: true,
    message: 'Spin recorded successfully',
    user: updatedUser,
    inviterCredited,
    inviterId
  });
});

// Submit USDT Withdrawal Request ($25 Return)
app.post('/api/users/:id/withdraw', (req, res) => {
  const { address, network, amount } = req.body;
  const user = db.getById(req.params.id);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (!address) {
    return res.status(400).json({ success: false, message: 'USDT withdrawal address is required' });
  }

  const withdrawalRequest = {
    id: `wtx-${Date.now()}`,
    amount: parseFloat(amount) || 25.00,
    address: address.trim(),
    network: network || 'USDT TRC-20',
    status: 'pending_admin',
    requestedAt: new Date().toISOString()
  };

  const updated = db.update(user.id, {
    withdrawalRequest,
    availableBalance: 0.00
  });

  res.json({
    success: true,
    message: `Your $25.00 payout has been submitted and registered with cryptron`,
    user: updated
  });
});

// Admin: Approve USDT Payout
app.post('/api/users/:id/approve-payout', (req, res) => {
  const user = db.getById(req.params.id);
  if (!user || !user.withdrawalRequest) {
    return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
  }

  const updatedReq = {
    ...user.withdrawalRequest,
    status: 'approved',
    processedAt: new Date().toISOString()
  };

  const updated = db.update(user.id, {
    withdrawalRequest: updatedReq,
    totalProfits: (user.totalProfits || 0) + (user.withdrawalRequest.amount || 25.00)
  });

  res.json({
    success: true,
    message: 'USDT payout approved and marked completed',
    user: updated
  });
});

// Admin: Reject USDT Payout
app.post('/api/users/:id/reject-payout', (req, res) => {
  const user = db.getById(req.params.id);
  if (!user || !user.withdrawalRequest) {
    return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
  }

  const updatedReq = {
    ...user.withdrawalRequest,
    status: 'rejected',
    rejectedAt: new Date().toISOString()
  };

  const updated = db.update(user.id, {
    withdrawalRequest: updatedReq,
    availableBalance: user.withdrawalRequest.amount || 25.00 // refund balance
  });

  res.json({
    success: true,
    message: 'USDT payout request rejected',
    user: updated
  });
});

// Admin: Bypass Referral Requirement
app.post('/api/users/:id/bypass-referral', (req, res) => {
  const user = db.getById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const updated = db.update(user.id, {
    referralBypassed: true
  });

  res.json({
    success: true,
    message: 'Referral requirement bypassed for user',
    user: updated
  });
});

// Universal Two-Way Database Synchronization
app.post('/api/sync', (req, res) => {
  const { users } = req.body;
  if (!Array.isArray(users)) {
    return res.status(400).json({ success: false, message: 'Invalid users payload' });
  }

  const merged = db.merge(users);
  res.json({
    success: true,
    users: merged
  });
});

/* -------------------------------------------------------------
 * SERVE FRONTEND STATIC FILES
 * ------------------------------------------------------------- */
app.use(express.static(__dirname));

// Route handlers for clean HTML navigation
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/spin', (req, res) => res.sendFile(path.join(__dirname, 'spin.html')));
app.get('/plans', (req, res) => res.sendFile(path.join(__dirname, 'plans.html')));
app.get('/transactions', (req, res) => res.sendFile(path.join(__dirname, 'transactions.html')));
app.get('/markets', (req, res) => res.sendFile(path.join(__dirname, 'markets.html')));

// Catch-all fallback
app.get('*', (req, res) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not Found' });
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  CRYPTRON DYNAMIC PLATFORM RUNNING ON PORT ${PORT}`);
  console.log(`  Local URL:   http://localhost:${PORT}`);
  console.log(`  Admin Panel: http://localhost:${PORT}/admin.html`);
  console.log(`  API Status:  http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});
