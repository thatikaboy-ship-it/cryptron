/**
 * CRYPTRON Protocol - Terminal Test Runner
 * Executes end-to-end verification of Quick-Maturity, USDT Payouts, and Targeted Messaging
 */

// Mock localStorage for Node.js environment
const store = {};
global.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, val) => { store[key] = String(val); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};

global.window = {
  localStorage: global.localStorage
};

// Load db.js
require('./js/db.js');
const UserDatabase = global.window.UserDatabase;

console.log("\n=======================================================");
console.log("  🚀 RUNNING CRYPTRON AUTOMATED SYSTEM TEST SUITE");
console.log("=======================================================\n");

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  [PASS] ✓ ${testName}`);
    if (details) console.log(`         ↳ ${details}`);
    passedCount++;
  } else {
    console.log(`  [FAIL] ✕ ${testName}`);
    if (details) console.log(`         ↳ ERROR: ${details}`);
    failedCount++;
  }
}

try {
  // Test 1: UserDatabase Initialization & Seed Users
  const users = UserDatabase.getAllUsers();
  assert(users && users.length >= 3, "Test 1: User Database Seed Initialization", `Found ${users.length} registered users (USR-1001, USR-1002, USR-1003).`);

  // Test 2: Admin Quick-Maturity Engine
  const alexBefore = UserDatabase.getUserById('USR-1001');
  const maturedUser = UserDatabase.matureUserInvestment('USR-1001');
  const plan = maturedUser.activePlans[0];
  const isMatured = plan.maturityTimestamp <= Date.now() && plan.status === 'Matured';
  const balanceCredited = maturedUser.availableBalance === 25.00;
  assert(isMatured && balanceCredited, "Test 2: Admin Quick-Maturity Engine ($25 Yield Available)", `Contract matured instantly. Countdown is 0. Available balance set to $${maturedUser.availableBalance.toFixed(2)}.`);

  // Test 3: 5-Referral Enforcement & Admin Referral Waiver
  let referralBlocked = false;
  try {
    // USR-1001 initially has only 3 referrals
    UserDatabase.submitWithdrawalRequest('USR-1001', 25.00, "0x86fe2A034190Db4f2074A9107BBB65B1B10E3f4d");
  } catch (err) {
    referralBlocked = true;
  }
  assert(referralBlocked, "Test 3A: Referral Gate Protection", "Withdrawal blocked when client has < 5 referrals who spun the wheel.");

  // Admin waives referral rule for USR-1001
  UserDatabase.toggleReferralBypass('USR-1001');
  const alexBypassed = UserDatabase.getUserById('USR-1001');
  assert(alexBypassed.referralBypassed === true, "Test 3B: Admin Referral Waiver Bypass", `Admin successfully waived referral requirement for ${alexBypassed.name}.`);

  // Test 4: USDT Destination Address Registration & $25.00 Cap
  const testAddress = "0x86fe2A034190Db4f2074A9107BBB65B1B10E3f4d";
  let overLimitBlocked = false;
  try {
    UserDatabase.submitWithdrawalRequest('USR-1001', 35.00, testAddress);
  } catch (e) {
    overLimitBlocked = true;
  }
  assert(overLimitBlocked, "Test 4A: Max $25.00 Withdrawal Cap", "Blocked withdrawal attempt greater than $25.00 USDT.");

  const wreq = UserDatabase.submitWithdrawalRequest('USR-1001', 25.00, testAddress, "USDT (Tether)");
  const alexWithWreq = UserDatabase.getUserById('USR-1001');
  const wreqValid = alexWithWreq.withdrawalRequest && 
                    alexWithWreq.withdrawalRequest.usdtAddress === testAddress &&
                    alexWithWreq.withdrawalRequest.amount === 25.00 &&
                    alexWithWreq.withdrawalRequest.status === "Pending Settlement";
  assert(wreqValid, "Test 4B: Pasted USDT Tether Address Registration", `USDT address registered: ${testAddress}, Amount: $25.00 USDT, Status: Pending Settlement.`);

  // Test 5: Fresh Start Cycle Rule (Contract concluded, balance reset, wheel locked)
  const isFreshStart = alexWithWreq.activePlans.length === 0 &&
                       alexWithWreq.hasActiveInvestment === false &&
                       alexWithWreq.investmentStatus === "not_invested" &&
                       alexWithWreq.availableBalance === 0.00;
  assert(isFreshStart, "Test 5: Fresh Start Cycle After Withdrawal", `Active contracts archived. Available balance reset to $0.00. Investment status: not_invested.`);

  // Test 6: Admin Withdrawal Settlement Engine & On-Chain Tx Hash
  const settleTxHash = "0xTX_SETTLE_SUCCESS_888";
  const settled = UserDatabase.settleWithdrawalRequest('USR-1001', settleTxHash);
  const alexAfterSettle = UserDatabase.getUserById('USR-1001');
  const settleValid = !alexAfterSettle.withdrawalRequest && 
                      alexAfterSettle.withdrawalHistory.length > 0 && 
                      settled.status === "Settled" &&
                      settled.settlementTxHash === settleTxHash &&
                      alexAfterSettle.notifications.some(n => n.title.includes("USDT Payout Settled"));
  assert(settleValid, "Test 6: Admin On-Chain Payout Settlement", `Settled successfully. Queue cleared. Recorded on-chain hash: ${settled.settlementTxHash}`);

  // Test 7: Cycle Restart - User deposits $10 & Admin Activates New Vault
  UserDatabase.depositFunds('USR-1001', 10.00, '0xNEW_VAULT_CYCLE_DEPOSIT_HASH');
  UserDatabase.approveDeposit('USR-1001');
  const alexRestarted = UserDatabase.getUserById('USR-1001');
  const cycleRestarted = alexRestarted.activePlans.length === 1 &&
                         alexRestarted.investmentStatus === "active" &&
                         alexRestarted.hasActiveInvestment === true;
  assert(cycleRestarted, "Test 7: Vault Cycle Restart with New $10 Deposit", `Client successfully restarted with a new 7-day vault contract.`);

  // Test 8: Targeted Messaging - Individual Client Routing
  const indMsg = UserDatabase.sendMessage({
    targetType: "individual",
    targetUserId: "USR-1001",
    targetUserName: "Demo Investor",
    subject: "Personal Yield Audit",
    body: "Confidential message exclusively for Demo Investor.",
    priority: "urgent"
  });
  const alexInbox = UserDatabase.getMessagesForUser("USR-1001");
  const marcusInbox = UserDatabase.getMessagesForUser("USR-1003");
  const indRoutingValid = alexInbox.some(m => m.id === indMsg.id) && !marcusInbox.some(m => m.id === indMsg.id);
  assert(indRoutingValid, "Test 8: Targeted Messaging - Individual Client Routing", `Delivered to Demo Investor (USR-1001). Correctly isolated from Marcus Chen.`);

  // Test 9: Targeted Messaging - "All Active Clients" Broadcast
  const activeMsg = UserDatabase.sendMessage({
    targetType: "all_active",
    subject: "Active Vault Notice",
    body: "Message for all active stakers.",
    priority: "info"
  });
  const alexActiveInbox = UserDatabase.getMessagesForUser("USR-1001");
  const marcusActiveInbox = UserDatabase.getMessagesForUser("USR-1003");
  const activeRoutingValid = alexActiveInbox.some(m => m.id === activeMsg.id) && !marcusActiveInbox.some(m => m.id === activeMsg.id);
  assert(activeRoutingValid, "Test 9: Targeted Messaging - 'All Active Clients' Broadcast", `Delivered to active staker (Demo Investor). Correctly excluded inactive client (Marcus).`);

  // Test 10: Targeted Messaging - "All Non-Active Clients" Broadcast
  const inactiveMsg = UserDatabase.sendMessage({
    targetType: "all_inactive",
    subject: "Deposit Invitation",
    body: "Message for uninvested clients.",
    priority: "warning"
  });
  const alexInactiveInbox = UserDatabase.getMessagesForUser("USR-1001");
  const marcusInactiveInbox = UserDatabase.getMessagesForUser("USR-1003");
  const inactiveRoutingValid = !alexInactiveInbox.some(m => m.id === inactiveMsg.id) && marcusInactiveInbox.some(m => m.id === inactiveMsg.id);
  assert(inactiveRoutingValid, "Test 10: Targeted Messaging - 'All Non-Active Clients' Broadcast", `Delivered to uninvested client (Marcus). Correctly excluded active staker (Demo Investor).`);

  // Test 11: Targeted Messaging - "Clients with Withdrawal Request"
  UserDatabase.toggleReferralBypass('USR-1002');
  UserDatabase.approveDeposit('USR-1002');
  UserDatabase.matureUserInvestment('USR-1002');
  UserDatabase.submitWithdrawalRequest('USR-1002', 25.00, "0x39a1fe7c02b98811e9f45d8b8a7321");
  const wreqMsg = UserDatabase.sendMessage({
    targetType: "withdrawal_requested",
    subject: "Withdrawal Queue Update",
    body: "Notice for users with pending withdrawals.",
    priority: "success"
  });
  const elenaInbox = UserDatabase.getMessagesForUser("USR-1002");
  const marcusWreqInbox = UserDatabase.getMessagesForUser("USR-1003");
  const wreqRoutingValid = elenaInbox.some(m => m.id === wreqMsg.id) && !marcusWreqInbox.some(m => m.id === wreqMsg.id);
  assert(wreqRoutingValid, "Test 11: Targeted Messaging - 'Withdrawal Requested' Broadcast", `Delivered to Elena Rostova (has withdrawal request). Excluded Marcus Chen.`);

} catch (e) {
  console.error("\nUnexpected error during test execution:", e);
  failedCount++;
}

console.log("\n-------------------------------------------------------");
console.log(`  SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED out of ${passedCount + failedCount} TESTS`);
console.log("-------------------------------------------------------\n");
if (failedCount === 0) {
  console.log("  🎉 ALL PROTOCOL VERIFICATION TESTS PASSED SUCCESSFULLY!\n");
} else {
  process.exit(1);
}
