/**
 * CRYPTRON - 7-DAY CRYPTO YIELD CALCULATION ENGINE
 * Core Model: Invest $10 -> Receive $25 in 7 Days (250% Total Return / +$15 Profit)
 */

class InvestmentCalculator {
  /**
   * Calculate 7-Day Crypto Staking Return
   * @param {number} units - Number of $10 investment slots (e.g. 1 unit = $10, 5 units = $50)
   * @returns {object} Calculated return breakdown
   */
  static calculateSevenDayYield(units = 1) {
    const principal = units * 10;
    const totalPayout = units * 25;
    const netProfit = totalPayout - principal; // $15 per $10 invested
    const dailyPayout = totalPayout / 7;
    const dailyProfit = netProfit / 7;

    return {
      units,
      principal,
      totalPayout,
      netProfit,
      dailyPayout: Math.round(dailyPayout * 100) / 100,
      dailyProfit: Math.round(dailyProfit * 100) / 100,
      roiPercent: 250, // 250% total return
      multiplier: 2.50,
      days: 7
    };
  }
}

// Global UI Hook for interactive calculator elements
function setupInteractiveCalculator({
  unitsSliderId = 'calc-principal',
  unitsDisplayId = 'calc-principal-val',
  payoutValId = 'calc-future-val',
  profitValId = 'calc-profit-val',
  multiplierValId = 'calc-multiplier-val'
} = {}) {
  const slider = document.getElementById(unitsSliderId);
  const unitsDisplay = document.getElementById(unitsDisplayId);
  const payoutDisplay = document.getElementById(payoutValId);
  const profitDisplay = document.getElementById(profitValId);
  const multiplierDisplay = document.getElementById(multiplierValId);

  if (!slider || !payoutDisplay) return;

  function update() {
    // Slider value represents either amount in $10 increments or number of slots
    let amount = parseFloat(slider.value) || 10;
    let units = Math.max(1, Math.round(amount / 10));
    let principal = units * 10;

    const result = InvestmentCalculator.calculateSevenDayYield(units);

    if (unitsDisplay) {
      unitsDisplay.textContent = `$${principal.toFixed(2)} (${units} ${units === 1 ? 'Contract' : 'Contracts'})`;
    }
    if (payoutDisplay) {
      payoutDisplay.textContent = `$${result.totalPayout.toFixed(2)}`;
    }
    if (profitDisplay) {
      profitDisplay.textContent = `+$${result.netProfit.toFixed(2)}`;
    }
    if (multiplierDisplay) {
      multiplierDisplay.textContent = `2.50x in 7 Days`;
    }
  }

  slider.addEventListener('input', update);
  update();
}

window.InvestmentCalculator = InvestmentCalculator;
window.setupInteractiveCalculator = setupInteractiveCalculator;
