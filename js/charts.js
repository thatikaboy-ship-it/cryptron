/**
 * CRYPTRON - DATA VISUALIZATION & CRYPTO CHART ENGINE
 */

let portfolioChartInstance = null;
let allocationChartInstance = null;
let calculatorChartInstance = null;

// Mock historical crypto portfolio equity curves
const TIMEFRAME_DATA = {
  '1D': {
    labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '22:00', 'Now'],
    values: [101200, 101850, 102400, 102100, 102950, 103200, 103410, 103450.50]
  },
  '1W': {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    values: [96400, 97800, 97200, 99500, 101100, 102800, 103450.50]
  },
  '1M': {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    values: [88500, 92400, 97900, 103450.50]
  },
  '1Y': {
    labels: ['Q1', 'Q2', 'Q3', 'Q4', 'Jan', 'Mar', 'May', 'Jul', 'Sep'],
    values: [48000, 56000, 68000, 79000, 85000, 91000, 96000, 99500, 103450.50]
  },
  'ALL': {
    labels: ['2023', '2024 H1', '2024 H2', '2025 H1', '2025 H2', '2026 H1', 'Current'],
    values: [22000, 39000, 54000, 69000, 82000, 94000, 103450.50]
  }
};

/**
 * Initialize Portfolio Performance Area Line Chart
 */
function initPortfolioChart(canvasId = 'portfolioChart') {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const chartContext = ctx.getContext('2d');
  
  // Emerald / Cyan Crypto Glow Gradient
  const gradient = chartContext.createLinearGradient(0, 0, 0, 320);
  gradient.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
  gradient.addColorStop(0.7, 'rgba(6, 182, 212, 0.08)');
  gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');

  const initialData = TIMEFRAME_DATA['1M'];

  portfolioChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: initialData.labels,
      datasets: [{
        label: 'Crypto Portfolio Equity (USDT)',
        data: initialData.values,
        borderColor: '#10b981',
        borderWidth: 3,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#080d1a',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
        fill: true,
        backgroundColor: gradient,
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          titleColor: '#94a3b8',
          bodyColor: '#f8fafc',
          bodyFont: { weight: 'bold', size: 14 },
          padding: 12,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return `$${context.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.04)',
            drawBorder: false
          },
          ticks: {
            color: '#64748b',
            font: { family: 'Plus Jakarta Sans', size: 12 }
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: '#64748b',
            font: { family: 'Plus Jakarta Sans', size: 12 },
            callback: function(value) {
              return '$' + (value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value);
            }
          }
        }
      }
    }
  });

  // Timeframe switch buttons
  const timeframeButtons = document.querySelectorAll('[data-timeframe]');
  timeframeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      timeframeButtons.forEach(b => {
        b.classList.remove('bg-emerald-500/20', 'text-emerald-400', 'border-emerald-500/40');
        b.classList.add('text-slate-400', 'border-transparent');
      });
      btn.classList.add('bg-emerald-500/20', 'text-emerald-400', 'border-emerald-500/40');
      btn.classList.remove('text-slate-400', 'border-transparent');

      const tf = btn.getAttribute('data-timeframe');
      if (TIMEFRAME_DATA[tf]) {
        portfolioChartInstance.data.labels = TIMEFRAME_DATA[tf].labels;
        portfolioChartInstance.data.datasets[0].data = TIMEFRAME_DATA[tf].values;
        portfolioChartInstance.update();
      }
    });
  });
}

/**
 * Initialize Crypto Asset Allocation Donut Chart
 */
function initAllocationChart(canvasId = 'allocationChart') {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  allocationChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['BTC & ETH Quant Nodes', 'PoS Validator Staking (SOL/ETH)', 'DeFi AMM Liquidity', 'USDT/USDC Reserves'],
      datasets: [{
        data: [45, 25, 20, 10],
        backgroundColor: [
          '#10b981', // Emerald - BTC/ETH
          '#06b6d4', // Cyan - PoS Staking
          '#8b5cf6', // Purple - DeFi AMM
          '#3b82f6'  // Blue - Stable Reserves
        ],
        borderWidth: 3,
        borderColor: '#080d1a',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#94a3b8',
          bodyColor: '#f8fafc',
          padding: 10,
          callbacks: {
            label: function(context) {
              return ` ${context.label}: ${context.parsed}%`;
            }
          }
        }
      }
    }
  });
}

/**
 * Initialize Calculator Growth Projection Chart
 */
function initCalculatorChart(canvasId = 'calcProjectionChart') {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  calculatorChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Yr 1', 'Yr 2', 'Yr 3', 'Yr 4', 'Yr 5'],
      datasets: [
        {
          label: 'Principal Crypto Deposited',
          data: [10000, 14000, 18000, 22000, 26000],
          backgroundColor: '#334155',
          borderRadius: 6
        },
        {
          label: 'Compounded Crypto Yield',
          data: [13500, 22800, 38400, 61200, 94600],
          backgroundColor: '#10b981',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#64748b' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#64748b',
            callback: (val) => '$' + (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val)
          }
        }
      }
    }
  });

  window.updateCalculatorChart = function(yearlyBreakdown) {
    if (!calculatorChartInstance || !yearlyBreakdown) return;
    calculatorChartInstance.data.labels = yearlyBreakdown.map(item => `Yr ${item.year}`);
    calculatorChartInstance.data.datasets[0].data = yearlyBreakdown.map(item => item.totalInvested);
    calculatorChartInstance.data.datasets[1].data = yearlyBreakdown.map(item => item.balance);
    calculatorChartInstance.update();
  };
}

window.initPortfolioChart = initPortfolioChart;
window.initAllocationChart = initAllocationChart;
window.initCalculatorChart = initCalculatorChart;
