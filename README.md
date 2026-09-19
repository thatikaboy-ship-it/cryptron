# CRYPTRON - Dynamic Full-Stack Web Platform

CRYPTRON is a full-stack dynamic cryptocurrency investment and yield platform with an integrated Node.js/Express backend, persistent server-side database, REST API endpoints, 7-Day Maturity Countdown, gamified Daily Spin Wheel, and real-time Administrator Portal.

---

## ⚡ Dynamic Architecture Overview

Unlike static websites that keep data trapped in a visitor's single browser, **CRYPTRON is a dynamic web application**:
- **Dynamic Backend**: Express.js server (`server.js`) handling REST API requests and serving the frontend.
- **Server-Side Persistent Database**: Stores all registered users, referrals, deposit hashes, spins, and USDT payout requests on the server (`data/cryptron_database.json`) with atomic file writes.
- **Global Cross-Device Synchronization**: Any user signing up, depositing, spinning, or requesting a withdrawal from **any device or browser worldwide** is instantly saved to the server and visible to the admin.
- **Offline & Fallback Resilient**: Works out-of-the-box in dynamic mode while retaining local cache support.

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```

### 3. Open in Browser
- **Client Website**: [http://localhost:3000](http://localhost:3000)
- **Admin Portal**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)
- **API Health Check**: [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 🌐 1-Click Free Cloud Deployment

You can deploy CRYPTRON for free directly from this GitHub repository to any dynamic cloud host:

### Option A: Deploy on Render (Recommended - Free)
1. Go to [render.com](https://render.com) and sign up/log in.
2. Click **New +** > **Web Service**.
3. Connect your GitHub repository: `thatikaboy-ship-it/cryptron`.
4. Render will automatically detect the configuration:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Click **Create Web Service**. Your dynamic site is live worldwide!

### Option B: Deploy on Railway (Free)
1. Go to [railway.app](https://railway.app) and connect your GitHub repository.
2. Railway reads [`railway.json`](file:///c:/Users/1030g2/Desktop/investment-website/railway.json) automatically and deploys the dynamic server.

### Option C: Deploy with Docker
```bash
docker build -t cryptron .
docker run -p 3000:3000 cryptron
```

---

## 📂 Project Structure

```
cryptron/
├── server.js                   # Dynamic Node.js / Express backend server
├── package.json                # Project dependencies & start scripts
├── Procfile                    # Web process command for cloud hosts
├── render.yaml                 # 1-click blueprint for Render.com
├── railway.json                # Deployment configuration for Railway.app
├── vercel.json                 # Deployment configuration for Vercel
├── Dockerfile                  # Containerized deployment specification
├── data/
│   └── cryptron_database.json  # Persistent server database (atomic file writes)
├── index.html                  # Landing Page ($10 ➔ $25 in 7 Days)
├── dashboard.html              # Client Staking Portal (Live 7-Day Countdown)
├── admin.html                  # Administrator Portal (Global live database)
├── login.html                  # User Authentication & Registration
├── spin.html                   # Daily $10,000 Spin the Wheel (Verified stakers only)
├── plans.html                  # The $10 Vault Details
├── transactions.html           # Public Ledger
├── css/
│   └── styles.css              # Custom styling & glassmorphism
└── js/
    ├── app.js                  # Frontend client engine
    ├── db.js                   # Client-side dynamic API adapter & sync engine
    ├── calculator.js           # Compounding yield math
    └── charts.js               # Performance charts
```

---

## 🔌 Dynamic REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server status and database health check |
| `GET` | `/api/stats` | Platform statistics (total users, active volume, pending payouts) |
| `GET` | `/api/users` | Retrieve all registered users worldwide (Admin) |
| `GET` | `/api/users/:id` | Retrieve single user record by ID or email |
| `POST` | `/api/auth/register` | Register new user with unique numeric referral ID |
| `POST` | `/api/auth/login` | Authenticate user credentials |
| `POST` | `/api/users/:id/deposit` | Submit $10 blockchain transaction hash for review |
| `POST` | `/api/users/:id/activate` | Admin activates the 7-day $10 yield vault |
| `POST` | `/api/users/:id/reject-deposit` | Admin rejects invalid deposit hash |
| `POST` | `/api/users/:id/spin` | Record spin (requires active $10 vault; auto-credits inviter) |
| `POST` | `/api/users/:id/withdraw` | Submit $25 USDT payout request with wallet address |
| `POST` | `/api/users/:id/approve-payout` | Admin approves and marks USDT withdrawal completed |
| `POST` | `/api/users/:id/reject-payout` | Admin rejects payout request and refunds balance |
| `POST` | `/api/users/:id/bypass-referral` | Admin bypasses referral requirement for client |
| `POST` | `/api/sync` | Two-way database merge synchronization |

---

## 💳 Official Deposit Wallet

- **Token**: USDT (Tether)
- **Supported Networks**: ERC-20, BEP-20 (BSC), Polygon, TRC-20
- **Official Vault Address**: `0x86fe2A034190Db4f2074A9107BBB65B1B10E3f4d`

---

## 🔐 Master Administrator Access

- **Admin URL**: `/admin.html`
- **Master Passcodes**: `admin123` or `8899`
- Allows instant activation of client vaults, live inspection of all users worldwide, approval/rejection of USDT withdrawal requests, real-time messaging, and CSV/JSON data export.
