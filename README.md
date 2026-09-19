# CRYPTRON - User Database & 7-Day Crypto Staking Platform

CRYPTRON is a crypto yield platform designed with an interactive 7-Day Maturity Countdown, gamified Daily Spin Wheel, and a user registration database system.

---

## 🚀 Directory Structure & Pages

```
investment-website/
├── index.html              # Main Landing Page ($10 ➔ $25 in 7 Days, Multiplier Calculator)
├── dashboard.html          # Client Staking Portal (Live Days:Hours:Mins:Secs Countdown)
├── plans.html              # The $10 Vault Page & Contract Details
├── spin.html               # Daily $10,000 Spin the Wheel Game (Requires active $10 plan)
├── admin.html              # Admin User Database (View all signups, search, export to CSV/Excel)
├── transactions.html       # On-Chain Settlement Ledger & Transaction Receipts
├── login.html              # Authentication & User Registration (Saves directly to Database)
├── css/
│   └── styles.css          # Styling, glassmorphism & responsive layouts
├── js/
│   ├── app.js              # State engine (countdown calculations, referral tracking, spin physics)
│   ├── db.js               # Database engine for storing and querying registered users
│   ├── calculator.js       # Mathematical compounding algorithms
│   └── charts.js           # Chart.js visualization engine
└── README.md               # Complete platform documentation
```

---

## 💳 Official Deposit Wallet

- **Token**: USDT (Tether)
- **Supported Networks**: ERC-20, BEP-20 (BSC), Polygon
- **Official Vault Address**: `0x86fe2A034190Db4f2074A9107BBB65B1B10E3f4d`
- All client deposit prompts, modals, and copy buttons are configured to this address.

---

## 📊 User Database & Admin Control System

1. **Automatic Registration Storage (`js/db.js`)**:
   - Whenever any visitor registers via [login.html](file:///c:/Users/1030g2/Desktop/investment-website/login.html), their full name, email address, registration timestamp, auto-generated wallet address, and unique promo code (client's first name + random numbers) are permanently saved to the database.
   - Prevents duplicate signups with the same email.

2. **Protected Admin Portal ([admin.html](file:///c:/Users/1030g2/Desktop/investment-website/admin.html))**:
   - **Passcode Protected**: Hidden from regular visitors and secured by a master PIN (`admin123` or `8899`).
   - **One-Click Manual Activation**: Click **"Approve & Start Timer"** for any user to verify their $10 deposit and start their 7-day countdown.
   - **Live Timer Monitor**: Real-time ticker showing remaining time on all active client investments.
   - **CSV Export**: 1-click **"Export Users (CSV)"** to download the entire database and open it in Microsoft Excel or Google Sheets.

---

## 💎 Core Platform Features

1. **7-Day Live Maturity Countdown**:
   - Displays real-time **Days, Hours, Minutes, and Seconds** on all active $10 contracts in [dashboard.html](file:///c:/Users/1030g2/Desktop/investment-website/dashboard.html).
   - Counts down second-by-second to the $25 payout release.

2. **In-Page Transaction Hash Submission**:
   - Dedicated box on [dashboard.html](file:///c:/Users/1030g2/Desktop/investment-website/dashboard.html) for clients to paste their blockchain TxID after sending $10 to `0x86fe2A034190Db4f2074A9107BBB65B1B10E3f4d`.

3. **Daily Spin the Wheel ([spin.html](file:///c:/Users/1030g2/Desktop/investment-website/spin.html))**:
   - Interactive 8-segment canvas wheel unlocked for stakers.

4. **Client Logout**:
   - Secure session termination button available on all portals.
