/**
 * CRYPTRONVEST - LIVE MARKET SIMULATOR & COINMARKETCAP TELEMETRY ENGINE
 * Real-time ticking engine for crypto prices with dynamic green/red micro-pulses
 */

class LiveMarketEngine {
  constructor() {
    this.assets = {
      btc: { name: 'Bitcoin', symbol: 'BTC', price: 68420.50, change: 3.42, decimals: 2 },
      eth: { name: 'Ethereum', symbol: 'ETH', price: 3540.20, change: 2.84, decimals: 2 },
      sol: { name: 'Solana', symbol: 'SOL', price: 164.80, change: 6.18, decimals: 2 },
      bnb: { name: 'BNB', symbol: 'BNB', price: 592.10, change: 1.95, decimals: 2 },
      xrp: { name: 'XRP', symbol: 'XRP', price: 0.5842, change: 1.45, decimals: 4 },
      doge: { name: 'Dogecoin', symbol: 'DOGE', price: 0.1245, change: 4.10, decimals: 4 },
      ton: { name: 'Toncoin', symbol: 'TON', price: 5.82, change: 3.10, decimals: 2 },
      ada: { name: 'Cardano', symbol: 'ADA', price: 0.3620, change: 1.80, decimals: 4 },
      trx: { name: 'TRON', symbol: 'TRX', price: 0.1540, change: 0.95, decimals: 4 },
      avax: { name: 'Avalanche', symbol: 'AVAX', price: 29.60, change: 4.22, decimals: 2 },
      link: { name: 'Chainlink', symbol: 'LINK', price: 12.30, change: 2.40, decimals: 2 },
      sui: { name: 'Sui', symbol: 'SUI', price: 1.88, change: 8.40, decimals: 2 }
    };

    this.totalMarketCap = 2.42; // Trillion USD
    this.total24hVol = 84.6;   // Billion USD
    this.timer = null;
  }

  formatPrice(price, decimals) {
    if (price >= 1000) {
      return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return '$' + price.toFixed(decimals);
  }

  formatPercent(pct) {
    const prefix = pct >= 0 ? '+' : '';
    return prefix + pct.toFixed(2) + '%';
  }

  tickAsset(key) {
    const asset = this.assets[key];
    if (!asset) return;

    // Small realistic micro-variation: between -0.15% and +0.18%
    const changeFactor = (Math.random() * 0.33 - 0.15) / 100;
    const oldPrice = asset.price;
    asset.price = Math.max(0.0001, asset.price * (1 + changeFactor));
    const isUp = asset.price >= oldPrice;

    // Slight shift to 24h percentage
    asset.change += (changeFactor * 10);

    const priceText = this.formatPrice(asset.price, asset.decimals);
    const pctText = this.formatPercent(asset.change);

    // Update Set 1 and Set 2 (for continuous marquee loops)
    [1, 2].forEach(setIdx => {
      const priceEl = document.getElementById(`ticker-price-${key}-${setIdx}`);
      const pctEl = document.getElementById(`ticker-pct-${key}-${setIdx}`);

      if (priceEl) {
        priceEl.textContent = priceText;
        const flashClass = isUp ? 'price-flash-green' : 'price-flash-red';
        priceEl.classList.remove('price-flash-green', 'price-flash-red');
        void priceEl.offsetWidth; // Trigger DOM reflow for CSS animation restart
        priceEl.classList.add(flashClass);
        setTimeout(() => {
          if (priceEl) priceEl.classList.remove(flashClass);
        }, 700);
      }

      if (pctEl) {
        pctEl.textContent = pctText;
        if (asset.change >= 0) {
          pctEl.className = 'text-emerald-400 text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded font-bold';
        } else {
          pctEl.className = 'text-rose-400 text-[10px] bg-rose-500/10 px-1.5 py-0.5 rounded font-bold';
        }
      }
    });

    // Also update markets.html watchlist items if present
    const watchlistPriceEl = document.getElementById(`wl-price-${key}`);
    const watchlistPctEl = document.getElementById(`wl-pct-${key}`);
    if (watchlistPriceEl) watchlistPriceEl.textContent = priceText;
    if (watchlistPctEl) {
      watchlistPctEl.textContent = pctText;
      watchlistPctEl.className = asset.change >= 0 ? 'text-[10px] text-emerald-400' : 'text-[10px] text-rose-400';
    }
  }

  tickCMCHeader() {
    const mcapEl = document.getElementById('cmc-total-mcap');
    const volEl = document.getElementById('cmc-24h-vol');
    const mcapChangeEl = document.getElementById('cmc-mcap-change');

    if (!mcapEl && !volEl) return;

    // Small drift
    const mcapDrift = (Math.random() * 0.02 - 0.009);
    this.totalMarketCap = Math.max(2.1, Math.min(2.8, this.totalMarketCap + mcapDrift));

    const volDrift = (Math.random() * 0.4 - 0.2);
    this.total24hVol = Math.max(70, Math.min(100, this.total24hVol + volDrift));

    if (mcapEl) {
      mcapEl.textContent = `$${this.totalMarketCap.toFixed(2)}T`;
    }
    if (volEl) {
      volEl.textContent = `$${this.total24hVol.toFixed(1)}B`;
    }
    if (mcapChangeEl) {
      const isUp = mcapDrift >= 0;
      mcapChangeEl.innerHTML = isUp ? `▲ ${(2.14 + (mcapDrift * 5)).toFixed(2)}%` : `▼ ${(2.14 + (mcapDrift * 5)).toFixed(2)}%`;
      mcapChangeEl.className = isUp ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold';
    }
  }

  step() {
    if (document.hidden) return; // Save CPU when tab is in background

    // Pick 2 to 4 random assets to tick
    const keys = Object.keys(this.assets);
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      this.tickAsset(randomKey);
    }

    // Occasionally tick CMC header
    if (Math.random() > 0.4) {
      this.tickCMCHeader();
    }
  }

  start(intervalMs = 2200) {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.step(), intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

// Auto-initialize when document is ready
if (typeof window !== 'undefined') {
  window.LiveMarketEngine = LiveMarketEngine;
  document.addEventListener('DOMContentLoaded', () => {
    window.cryptronMarkets = new LiveMarketEngine();
    window.cryptronMarkets.start(2200);
  });
}
