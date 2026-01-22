import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { RefreshCw, Brain, CheckCircle, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

const CRYPTO_OPTIONS = [
  { id: 'BTCUSDT', symbol: 'BTC', name: 'Bitcoin', color: '#f7931a' },
  { id: 'ETHUSDT', symbol: 'ETH', name: 'Ethereum', color: '#627eea' },
  { id: 'BNBUSDT', symbol: 'BNB', name: 'BNB', color: '#f3ba2f' },
  { id: 'SOLUSDT', symbol: 'SOL', name: 'Solana', color: '#14f195' },
  { id: 'XRPUSDT', symbol: 'XRP', name: 'XRP', color: '#23292f' },
  { id: 'ADAUSDT', symbol: 'ADA', name: 'Cardano', color: '#0033ad' },
  { id: 'AVAXUSDT', symbol: 'AVAX', name: 'Avalanche', color: '#e84142' },
  { id: 'DOTUSDT', symbol: 'DOT', name: 'Polkadot', color: '#e6007a' },
  { id: 'DOGEUSDT', symbol: 'DOGE', name: 'Dogecoin', color: '#c2a633' },
  { id: 'LINKUSDT', symbol: 'LINK', name: 'Chainlink', color: '#2a5ada' },
];

const INTERVAL_OPTIONS = [
  { value: '1m', label: '1 Min' }, { value: '5m', label: '5 Min' },
  { value: '15m', label: '15 Min' }, { value: '30m', label: '30 Min' },
  { value: '1h', label: '1 Hour' }, { value: '2h', label: '2 Hours' },
  { value: '4h', label: '4 Hours' }, { value: '1d', label: '1 Day' }, { value: '1w', label: '1 Week' },
];

export default function App() {
  const [data, setData] = useState([]);
  const [timeframe, setTimeframe] = useState('7D');
  const [interval, setInterval] = useState('1d');
  const [asset1, setAsset1] = useState('BTCUSDT');
  const [asset2, setAsset2] = useState('ETHUSDT');
  const [loading, setLoading] = useState(false);
  const [priceInfo, setPriceInfo] = useState({ asset1: null, asset2: null });
  const [algoAnalysis, setAlgoAnalysis] = useState(null);
  const [backtestResults, setBacktestResults] = useState(null);
  const [mlMetrics, setMlMetrics] = useState(null);
  const [trendAnalysis, setTrendAnalysis] = useState(null);
  const [btcPrices, setBtcPrices] = useState([]);

  const getAssetInfo = (id) => CRYPTO_OPTIONS.find(a => a.id === id) || CRYPTO_OPTIONS[0];

  const getTimeframeDetails = (tf, si) => {
    const map = {
      '1D': { '1h': 24, '2h': 12, '4h': 6, '15m': 96, '30m': 48, '1m': 1440, '5m': 288 },
      '7D': { '1h': 168, '2h': 84, '4h': 42, '1d': 7 },
      '1M': { '1d': 30, '1h': 720, '4h': 180 },
      '3M': { '1w': 12, '1d': 90 },
      '6M': { '1w': 26, '1d': 180 },
      '1Y': { '1w': 52, '1d': 365 }
    };
    if (tf === 'YTD') {
      const days = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 1)) / 86400000);
      return { interval: si === '1w' ? '1w' : '1d', limit: si === '1w' ? Math.ceil(days / 7) : days };
    }
    const tfMap = map[tf] || {};
    return { interval: tfMap[si] ? si : Object.keys(tfMap)[0] || '1d', limit: tfMap[si] || Object.values(tfMap)[0] || 7 };
  };

  // ==================== TREND DETECTION FUNCTIONS ====================

  // Calculate Simple Moving Average
  const calcSMA = (prices, period) => {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  };

  // Calculate Exponential Moving Average
  const calcEMA = (prices, period) => {
    if (prices.length < period) return null;
    const k = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  };

  // Calculate RSI
  const calcRSI = (prices, period) => {
    if (prices.length < period + 1) return 50;
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    const recentChanges = changes.slice(-period);
    let gains = 0, losses = 0;
    for (let i = 0; i < recentChanges.length; i++) {
      if (recentChanges[i] > 0) { gains = gains + recentChanges[i]; }
      else { losses = losses + Math.abs(recentChanges[i]); }
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  // Calculate MACD
  const calcMACD = (prices) => {
    if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };
    const ema12 = calcEMA(prices, 12);
    const ema26 = calcEMA(prices, 26);
    const macd = ema12 - ema26;
    // Simplified signal line
    const macdHistory = [];
    for (let i = 26; i <= prices.length; i++) {
      const e12 = calcEMA(prices.slice(0, i), 12);
      const e26 = calcEMA(prices.slice(0, i), 26);
      macdHistory.push(e12 - e26);
    }
    const signal = macdHistory.length >= 9 ? calcEMA(macdHistory, 9) : macd;
    return { macd: macd, signal: signal, histogram: macd - signal };
  };

  // Detect Market Trend using multiple indicators
  const detectMarketTrend = (prices) => {
    if (prices.length < 30) {
      return { trend: 'UNKNOWN', strength: 0, confidence: 0, signals: {} };
    }

    const currentPrice = prices[prices.length - 1];
    const sma20 = calcSMA(prices, 20);
    const sma50 = calcSMA(prices, Math.min(50, prices.length));
    const ema12 = calcEMA(prices, 12);
    const ema26 = calcEMA(prices, 26);
    const rsi = calcRSI(prices, 14);
    const macd = calcMACD(prices);

    // Price position relative to MAs
    const aboveSMA20 = currentPrice > sma20;
    const aboveSMA50 = sma50 ? currentPrice > sma50 : aboveSMA20;
    const aboveEMA12 = currentPrice > ema12;
    const aboveEMA26 = currentPrice > ema26;

    // MA alignment (bullish = shorter above longer)
    const maAlignmentBullish = ema12 > ema26;
    const smaAlignmentBullish = sma50 ? sma20 > sma50 : true;

    // Price momentum (recent performance)
    const recentPrices = prices.slice(-5);
    const priceChange5 = ((recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0]) * 100;
    
    const longerPrices = prices.slice(-20);
    const priceChange20 = ((longerPrices[longerPrices.length - 1] - longerPrices[0]) / longerPrices[0]) * 100;

    // Scoring system
    let bullScore = 0;
    let bearScore = 0;

    // MA position scoring
    if (aboveSMA20) { bullScore = bullScore + 15; } else { bearScore = bearScore + 15; }
    if (aboveSMA50) { bullScore = bullScore + 15; } else { bearScore = bearScore + 15; }
    if (aboveEMA12) { bullScore = bullScore + 10; } else { bearScore = bearScore + 10; }
    if (aboveEMA26) { bullScore = bullScore + 10; } else { bearScore = bearScore + 10; }

    // MA alignment scoring
    if (maAlignmentBullish) { bullScore = bullScore + 15; } else { bearScore = bearScore + 15; }
    if (smaAlignmentBullish) { bullScore = bullScore + 10; } else { bearScore = bearScore + 10; }

    // RSI scoring
    if (rsi > 60) { bullScore = bullScore + 10; }
    else if (rsi > 50) { bullScore = bullScore + 5; }
    else if (rsi < 40) { bearScore = bearScore + 10; }
    else if (rsi < 50) { bearScore = bearScore + 5; }

    // MACD scoring
    if (macd.histogram > 0) { bullScore = bullScore + 10; } else { bearScore = bearScore + 10; }
    if (macd.macd > 0) { bullScore = bullScore + 5; } else { bearScore = bearScore + 5; }

    const totalScore = bullScore + bearScore;
    const bullishPercent = (bullScore / totalScore) * 100;
    const bearishPercent = (bearScore / totalScore) * 100;

    let trend, strength, recommendation;
    
    if (bullishPercent >= 65) {
      trend = 'UPTREND';
      strength = Math.min(100, (bullishPercent - 50) * 2);
      recommendation = 'Bull market - Alts typically outperform. Favor LONG ALT / SHORT BTC.';
    } else if (bearishPercent >= 65) {
      trend = 'DOWNTREND';
      strength = Math.min(100, (bearishPercent - 50) * 2);
      recommendation = 'Bear market - BTC typically outperforms. Favor LONG BTC / SHORT ALT.';
    } else {
      trend = 'SIDEWAYS';
      strength = 50 - Math.abs(bullishPercent - 50);
      recommendation = 'Choppy market - Use standard mean reversion. Reduce position size.';
    }

    // Detect potential reversal
    let reversalSignal = 'NONE';
    let reversalStrength = 0;

    // Bearish reversal signals (in uptrend)
    if (trend === 'UPTREND' || bullishPercent > 50) {
      if (rsi > 70 && macd.histogram < 0) {
        reversalSignal = 'BEARISH_REVERSAL';
        reversalStrength = Math.min(100, (rsi - 70) * 3 + Math.abs(macd.histogram) * 10);
      } else if (rsi > 75) {
        reversalSignal = 'OVERBOUGHT';
        reversalStrength = Math.min(100, (rsi - 70) * 4);
      } else if (priceChange5 < -3 && priceChange20 > 5) {
        reversalSignal = 'PULLBACK';
        reversalStrength = Math.min(80, Math.abs(priceChange5) * 10);
      }
    }

    // Bullish reversal signals (in downtrend)
    if (trend === 'DOWNTREND' || bearishPercent > 50) {
      if (rsi < 30 && macd.histogram > 0) {
        reversalSignal = 'BULLISH_REVERSAL';
        reversalStrength = Math.min(100, (30 - rsi) * 3 + Math.abs(macd.histogram) * 10);
      } else if (rsi < 25) {
        reversalSignal = 'OVERSOLD';
        reversalStrength = Math.min(100, (30 - rsi) * 4);
      } else if (priceChange5 > 3 && priceChange20 < -5) {
        reversalSignal = 'BOUNCE';
        reversalStrength = Math.min(80, priceChange5 * 10);
      }
    }

    return {
      trend: trend,
      strength: strength.toFixed(1),
      confidence: Math.abs(bullishPercent - 50).toFixed(1),
      bullishPercent: bullishPercent.toFixed(1),
      bearishPercent: bearishPercent.toFixed(1),
      recommendation: recommendation,
      reversalSignal: reversalSignal,
      reversalStrength: reversalStrength.toFixed(1),
      signals: {
        price: currentPrice,
        sma20: sma20 ? sma20.toFixed(2) : 'N/A',
        sma50: sma50 ? sma50.toFixed(2) : 'N/A',
        ema12: ema12 ? ema12.toFixed(2) : 'N/A',
        ema26: ema26 ? ema26.toFixed(2) : 'N/A',
        rsi: rsi.toFixed(1),
        macd: macd.macd.toFixed(4),
        macdSignal: macd.signal.toFixed(4),
        macdHistogram: macd.histogram.toFixed(4),
        priceChange5: priceChange5.toFixed(2),
        priceChange20: priceChange20.toFixed(2),
        aboveSMA20: aboveSMA20,
        aboveSMA50: aboveSMA50,
        maAlignmentBullish: maAlignmentBullish
      }
    };
  };

  // Analyze historical performance by trend regime
  const analyzePerformanceByRegime = (chartData, prices, a1Symbol, a2Symbol) => {
    if (chartData.length < 30 || prices.length < 30) {
      return { uptrendStats: null, downtrendStats: null, recommendation: 'Insufficient data' };
    }

    const uptrendPeriods = { a1Wins: 0, a2Wins: 0, totalGapChange: 0, count: 0 };
    const downtrendPeriods = { a1Wins: 0, a2Wins: 0, totalGapChange: 0, count: 0 };

    // Analyze each period
    for (let i = 20; i < chartData.length - 1; i++) {
      const priceSlice = prices.slice(Math.max(0, i - 20), i);
      const sma10 = priceSlice.slice(-10).reduce((a, b) => a + b, 0) / 10;
      const sma20 = priceSlice.reduce((a, b) => a + b, 0) / priceSlice.length;
      const currentPrice = prices[i];
      
      const isUptrend = currentPrice > sma10 && sma10 > sma20;
      const isDowntrend = currentPrice < sma10 && sma10 < sma20;

      const gapChange = chartData[i + 1].diff - chartData[i].diff;
      const a1Daily = chartData[i + 1].asset1Daily - chartData[i].asset1Daily;
      const a2Daily = chartData[i + 1].asset2Daily - chartData[i].asset2Daily;

      if (isUptrend) {
        uptrendPeriods.count = uptrendPeriods.count + 1;
        uptrendPeriods.totalGapChange = uptrendPeriods.totalGapChange + gapChange;
        if (a1Daily > a2Daily) { uptrendPeriods.a1Wins = uptrendPeriods.a1Wins + 1; }
        else { uptrendPeriods.a2Wins = uptrendPeriods.a2Wins + 1; }
      } else if (isDowntrend) {
        downtrendPeriods.count = downtrendPeriods.count + 1;
        downtrendPeriods.totalGapChange = downtrendPeriods.totalGapChange + gapChange;
        if (a1Daily > a2Daily) { downtrendPeriods.a1Wins = downtrendPeriods.a1Wins + 1; }
        else { downtrendPeriods.a2Wins = downtrendPeriods.a2Wins + 1; }
      }
    }

    const uptrendStats = uptrendPeriods.count > 5 ? {
      periods: uptrendPeriods.count,
      a1WinRate: ((uptrendPeriods.a1Wins / uptrendPeriods.count) * 100).toFixed(1),
      a2WinRate: ((uptrendPeriods.a2Wins / uptrendPeriods.count) * 100).toFixed(1),
      avgGapChange: (uptrendPeriods.totalGapChange / uptrendPeriods.count).toFixed(3),
      favors: uptrendPeriods.a1Wins > uptrendPeriods.a2Wins ? a1Symbol : a2Symbol
    } : null;

    const downtrendStats = downtrendPeriods.count > 5 ? {
      periods: downtrendPeriods.count,
      a1WinRate: ((downtrendPeriods.a1Wins / downtrendPeriods.count) * 100).toFixed(1),
      a2WinRate: ((downtrendPeriods.a2Wins / downtrendPeriods.count) * 100).toFixed(1),
      avgGapChange: (downtrendPeriods.totalGapChange / downtrendPeriods.count).toFixed(3),
      favors: downtrendPeriods.a1Wins > downtrendPeriods.a2Wins ? a1Symbol : a2Symbol
    } : null;

    return { uptrendStats: uptrendStats, downtrendStats: downtrendStats };
  };

  // ==================== ORIGINAL ML FUNCTIONS ====================

  const calcReversionFactor = (chartData) => {
    if (chartData.length < 20) return { factor: 0.6, confidence: 0, samples: 0 };
    const diffs = chartData.map(d => d.diff);
    const samples = [];
    const lb = 10;
    for (let i = lb; i < diffs.length - 5; i++) {
      const hist = diffs.slice(i - lb, i);
      const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
      const std = Math.sqrt(hist.reduce((s, v) => s + (v - mean) ** 2, 0) / hist.length);
      const dev = diffs[i] - mean;
      if (Math.abs(dev) > std * 0.8) {
        for (let h = 1; h <= Math.min(5, diffs.length - i - 1); h++) {
          const futDev = diffs[i + h] - mean;
          if (Math.abs(dev) > 0.001) {
            const rev = 1 - (futDev / dev);
            if (rev > -0.5 && rev < 1.5) {
              samples.push({ rev: rev, wt: Math.abs(dev) / std });
            }
          }
        }
      }
    }
    if (samples.length < 5) return { factor: 0.6, confidence: 0, samples: 0 };
    const totWt = samples.reduce((s, x) => s + x.wt, 0);
    const wtRev = samples.reduce((s, x) => s + x.rev * x.wt, 0) / totWt;
    const revStd = Math.sqrt(samples.reduce((s, x) => s + (x.rev - wtRev) ** 2, 0) / samples.length);
    const conf = (Math.max(0, 1 - revStd) * 0.6 + Math.min(1, samples.length / 50) * 0.4) * 100;
    return { factor: Math.max(0.2, Math.min(0.95, wtRev)), confidence: conf.toFixed(1), samples: samples.length };
  };

  const optimizeThreshold = (chartData) => {
    if (chartData.length < 30) return { threshold: 1.2, bestWinRate: 0, bestProfitFactor: 0, bestTrades: 0 };
    const diffs = chartData.map(d => d.diff);
    let best = { threshold: 1.2, score: -Infinity, winRate: 0, pf: 0, trades: 0 };
    const thresholds = [0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.5];
    for (let t = 0; t < thresholds.length; t++) {
      const th = thresholds[t];
      let w = 0, l = 0, tp = 0, tl = 0;
      for (let i = 10; i < diffs.length - 1; i++) {
        const hist = diffs.slice(i - 10, i);
        const mean = hist.reduce((a, b) => a + b, 0) / 10;
        const std = Math.sqrt(hist.reduce((s, v) => s + (v - mean) ** 2, 0) / 10);
        const cur = diffs[i];
        const nxt = diffs[i + 1];
        if (cur > mean + th * std) {
          const pnl = cur - nxt;
          if (pnl > 0) { w = w + 1; tp = tp + pnl; } else { l = l + 1; tl = tl + Math.abs(pnl); }
        } else if (cur < mean - th * std) {
          const pnl = nxt - cur;
          if (pnl > 0) { w = w + 1; tp = tp + pnl; } else { l = l + 1; tl = tl + Math.abs(pnl); }
        }
      }
      const tot = w + l;
      if (tot >= 3) {
        const wr = w / tot;
        const pf = tl > 0 ? tp / tl : (tp > 0 ? 10 : 0);
        const score = wr * 40 + Math.min(pf, 3) * 20 + Math.min(tot, 20) * 2;
        if (score > best.score) {
          best = { threshold: th, score: score, winRate: (wr * 100).toFixed(1), pf: pf.toFixed(2), trades: tot };
        }
      }
    }
    return { threshold: best.threshold, bestWinRate: best.winRate, bestProfitFactor: best.pf, bestTrades: best.trades };
  };

  const calcHoldingPeriod = (chartData) => {
    if (chartData.length < 30) return { periods: 1, expectedReturn: 0, winRate: 0 };
    const diffs = chartData.map(d => d.diff);
    const results = {};
    for (let p = 1; p <= 5; p++) { results[p] = { returns: [], wins: 0, total: 0 }; }
    for (let i = 10; i < diffs.length - 5; i++) {
      const hist = diffs.slice(i - 10, i);
      const mean = hist.reduce((a, b) => a + b, 0) / 10;
      const std = Math.sqrt(hist.reduce((s, v) => s + (v - mean) ** 2, 0) / 10);
      if (Math.abs(diffs[i] - mean) > std) {
        const dir = diffs[i] > mean ? -1 : 1;
        for (let p = 1; p <= Math.min(5, diffs.length - i - 1); p++) {
          const pnl = dir * (diffs[i + p] - diffs[i]);
          results[p].returns.push(pnl);
          results[p].total = results[p].total + 1;
          if (pnl > 0) { results[p].wins = results[p].wins + 1; }
        }
      }
    }
    let bestP = 1, bestScore = -Infinity, bestWR = 0;
    for (let p = 1; p <= 5; p++) {
      if (results[p].total >= 3) {
        const avg = results[p].returns.reduce((a, b) => a + b, 0) / results[p].total;
        const wr = results[p].wins / results[p].total;
        const score = avg * 0.7 + wr * 0.3;
        if (score > bestScore) { bestScore = score; bestP = p; bestWR = (wr * 100).toFixed(1); }
      }
    }
    const expRet = results[bestP].returns.length > 0 ? (results[bestP].returns.reduce((a, b) => a + b, 0) / results[bestP].returns.length).toFixed(3) : 0;
    return { periods: bestP, expectedReturn: expRet, winRate: bestWR, samples: results[bestP].total };
  };

  const detectRegime = (chartData) => {
    if (chartData.length < 20) return { regime: 'UNKNOWN', strength: 0, recommendation: 'Insufficient data', autocorrelation: 0, hurstEstimate: 0.5 };
    const diffs = chartData.map(d => d.diff);
    const returns = [];
    for (let i = 1; i < diffs.length; i++) { returns.push(diffs[i] - diffs[i - 1]); }
    const meanRet = returns.reduce((a, b) => a + b, 0) / returns.length;
    let num = 0, den = 0;
    for (let i = 1; i < returns.length; i++) { num = num + (returns[i] - meanRet) * (returns[i - 1] - meanRet); }
    for (let i = 0; i < returns.length; i++) { den = den + (returns[i] - meanRet) ** 2; }
    const autocorr = den !== 0 ? num / den : 0;
    const n = Math.floor(diffs.length / 2);
    const h1 = diffs.slice(0, n), h2 = diffs.slice(n);
    const r1 = Math.max(...h1) - Math.min(...h1), r2 = Math.max(...h2) - Math.min(...h2);
    const m1 = h1.reduce((a, b) => a + b, 0) / n, m2 = h2.reduce((a, b) => a + b, 0) / n;
    const s1 = Math.sqrt(h1.reduce((s, v) => s + (v - m1) ** 2, 0) / n);
    const s2 = Math.sqrt(h2.reduce((s, v) => s + (v - m2) ** 2, 0) / n);
    const avgRS = ((s1 > 0 ? r1 / s1 : 0) + (s2 > 0 ? r2 / s2 : 0)) / 2;
    const hurst = avgRS > 0 ? Math.log(avgRS) / Math.log(n) : 0.5;
    let regime, strength, rec;
    if (autocorr < -0.15 || hurst < 0.45) {
      regime = 'MEAN_REVERTING'; strength = Math.min(100, Math.abs(autocorr) * 200 + (0.5 - hurst) * 100);
      rec = 'Mean reversion detected. Pairs trading recommended.';
    } else if (autocorr > 0.15 || hurst > 0.55) {
      regime = 'TRENDING'; strength = Math.min(100, autocorr * 200 + (hurst - 0.5) * 100);
      rec = 'Trending market. Consider momentum strategies.';
    } else { regime = 'NEUTRAL'; strength = 50; rec = 'No clear regime. Use conservative sizing.'; }
    return { regime: regime, strength: strength.toFixed(1), autocorrelation: autocorr.toFixed(3), hurstEstimate: hurst.toFixed(3), recommendation: rec };
  };

  const calcMLThresholds = (backtestRes, mlMet, chartData) => {
    if (!backtestRes || !mlMet || chartData.length < 10) {
      return { minWinRate: 50, minProfitFactor: 1.0, minGap: 0.5, source: 'DEFAULT' };
    }
    const diffs = chartData.map(d => d.diff);
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const std = Math.sqrt(diffs.reduce((s, v) => s + (v - mean) ** 2, 0) / diffs.length);
    const mlWinRate = parseFloat(mlMet.entryThreshold?.bestWinRate) || 50;
    const mlPF = parseFloat(mlMet.entryThreshold?.bestProfitFactor) || 1.0;
    const minWinRate = Math.max(45, mlWinRate - 10);
    const minProfitFactor = Math.max(0.8, mlPF * 0.7);
    const minGap = Math.max(0.3, std * 0.5);
    return { minWinRate: minWinRate, minProfitFactor: minProfitFactor, minGap: parseFloat(minGap.toFixed(2)), source: 'ML_OPTIMIZED', observedWinRate: mlWinRate, observedPF: mlPF };
  };

  const runMLAnalysis = (chartData) => {
    const rev = calcReversionFactor(chartData);
    const th = optimizeThreshold(chartData);
    const hp = calcHoldingPeriod(chartData);
    const reg = detectRegime(chartData);
    const revConf = parseFloat(rev.confidence) || 0;
    const thConf = parseFloat(th.bestWinRate) || 0;
    const regStr = parseFloat(reg.strength) || 0;
    const overall = revConf * 0.3 + thConf * 0.4 + (reg.regime === 'MEAN_REVERTING' ? regStr * 0.3 : regStr * 0.1);
    return { reversionFactor: rev, entryThreshold: th, holdingPeriod: hp, marketRegime: reg, overallConfidence: overall.toFixed(1), isMLReady: rev.samples >= 10 && th.bestTrades >= 5 };
  };

  const runBacktest = (chartData, ml) => {
    if (chartData.length < 20) return null;
    const th = ml?.entryThreshold?.threshold || 1.2;
    const diffs = chartData.map(d => d.diff);
    const trades = [];
    let w = 0, l = 0, tp = 0;
    for (let i = 10; i < chartData.length - 1; i++) {
      const hist = diffs.slice(i - 10, i);
      const mean = hist.reduce((a, b) => a + b, 0) / 10;
      const std = Math.sqrt(hist.reduce((s, v) => s + (v - mean) ** 2, 0) / 10);
      const cur = diffs[i], nxt = diffs[i + 1];
      let pnl = null, sig = null;
      if (cur > mean + th * std) { pnl = cur - nxt; sig = 'SHORT_GAP'; }
      else if (cur < mean - th * std) { pnl = nxt - cur; sig = 'LONG_GAP'; }
      if (pnl !== null) {
        tp = tp + pnl;
        if (pnl > 0) { w = w + 1; } else { l = l + 1; }
        trades.push({ entry: i, signal: sig, entryDiff: cur, exitDiff: nxt, profitLoss: pnl, win: pnl > 0 });
      }
    }
    const wr = trades.length > 0 ? (w / trades.length) * 100 : 0;
    const avgW = w > 0 ? trades.filter(t => t.win).reduce((s, t) => s + t.profitLoss, 0) / w : 0;
    const avgL = l > 0 ? Math.abs(trades.filter(t => !t.win).reduce((s, t) => s + t.profitLoss, 0) / l) : 0;
    const pf = avgL > 0 ? (avgW * w) / (avgL * l) : (w > 0 ? 999 : 0);
    return { totalTrades: trades.length, wins: w, losses: l, winRate: wr.toFixed(1), totalProfit: tp.toFixed(2), avgWin: avgW.toFixed(2), avgLoss: avgL.toFixed(2), profitFactor: pf.toFixed(2), entryThresholdUsed: th };
  };

  // ==================== ENHANCED PREDICTION WITH TREND ====================

  const generatePrediction = (chartData, backtestRes, a1Info, a2Info, ml, trend, regimeStats) => {
    if (!chartData.length || !backtestRes || !priceInfo.asset1 || !priceInfo.asset2) return null;
    
    const lastDiff = priceInfo.asset2.changeTimeframe - priceInfo.asset1.changeTimeframe;
    const diffs = chartData.map(d => d.diff);
    const mean = diffs.reduce((s, v) => s + v, 0) / diffs.length;
    const std = Math.sqrt(diffs.reduce((s, v) => s + (v - mean) ** 2, 0) / diffs.length);
    
    const mlRev = ml?.reversionFactor?.factor || 0.6;
    const mlTh = ml?.entryThreshold?.threshold || 1.2;
    const mlHP = ml?.holdingPeriod?.periods || 1;
    const gapRegime = ml?.marketRegime?.regime || 'UNKNOWN';
    
    const dynTh = calcMLThresholds(backtestRes, ml, chartData);
    const wr = parseFloat(backtestRes.winRate);
    const pf = parseFloat(backtestRes.profitFactor);
    const avgW = parseFloat(backtestRes.avgWin), avgL = parseFloat(backtestRes.avgLoss);
    const ev = (wr / 100 * avgW) - ((1 - wr / 100) * avgL) - 0.15;
    
    const meetsWR = wr >= dynTh.minWinRate;
    const meetsPF = pf >= dynTh.minProfitFactor;
    const meetsGap = Math.abs(lastDiff) >= dynTh.minGap;
    const mlRecommends = gapRegime === 'MEAN_REVERTING' || gapRegime === 'NEUTRAL';

    // ==================== TREND-ADJUSTED LOGIC ====================
    const marketTrend = trend?.trend || 'UNKNOWN';
    const trendStrength = parseFloat(trend?.strength) || 0;
    const reversalSignal = trend?.reversalSignal || 'NONE';
    const reversalStrength = parseFloat(trend?.reversalStrength) || 0;

    // Determine preferred direction based on trend
    let trendPreferredLong = null;
    let trendPreferredShort = null;
    let trendAdjustment = '';

    if (marketTrend === 'DOWNTREND' && trendStrength > 30) {
      // In downtrend, BTC (asset1 if BTC) typically stronger
      if (a1Info.symbol === 'BTC') {
        trendPreferredLong = a1Info.symbol;
        trendPreferredShort = a2Info.symbol;
        trendAdjustment = 'Downtrend favors BTC strength. ';
      } else if (a2Info.symbol === 'BTC') {
        trendPreferredLong = a2Info.symbol;
        trendPreferredShort = a1Info.symbol;
        trendAdjustment = 'Downtrend favors BTC strength. ';
      }
    } else if (marketTrend === 'UPTREND' && trendStrength > 30) {
      // In uptrend, alts typically outperform
      if (a1Info.symbol === 'BTC') {
        trendPreferredLong = a2Info.symbol;
        trendPreferredShort = a1Info.symbol;
        trendAdjustment = 'Uptrend favors alt outperformance. ';
      } else if (a2Info.symbol === 'BTC') {
        trendPreferredLong = a1Info.symbol;
        trendPreferredShort = a2Info.symbol;
        trendAdjustment = 'Uptrend favors alt outperformance. ';
      }
    }

    // Check for reversal warnings
    let reversalWarning = '';
    let reduceSize = false;
    
    if (reversalSignal === 'BEARISH_REVERSAL' || reversalSignal === 'OVERBOUGHT') {
      reversalWarning = '⚠️ Potential bearish reversal detected. ';
      reduceSize = reversalStrength > 50;
    } else if (reversalSignal === 'BULLISH_REVERSAL' || reversalSignal === 'OVERSOLD') {
      reversalWarning = '⚠️ Potential bullish reversal detected. ';
      reduceSize = reversalStrength > 50;
    } else if (reversalSignal === 'PULLBACK' || reversalSignal === 'BOUNCE') {
      reversalWarning = '📊 ' + reversalSignal + ' in progress. ';
    }

    const shouldTrade = mlRecommends && (meetsWR || meetsPF || meetsGap || ev > 0);
    
    const autoThresholds = { 
      minWinRate: dynTh.minWinRate, 
      minProfitFactor: dynTh.minProfitFactor, 
      minGap: dynTh.minGap, 
      expectedValue: ev.toFixed(3), 
      meetsWinRate: meetsWR, 
      meetsProfitFactor: meetsPF, 
      meetsGap: meetsGap, 
      actualWinRate: wr, 
      actualPF: pf, 
      actualGap: Math.abs(lastDiff).toFixed(2) 
    };

    if (!shouldTrade) {
      const reasons = [];
      if (!mlRecommends) { reasons.push('Gap regime ' + gapRegime + ' unfavorable'); }
      if (!meetsWR) { reasons.push('WR ' + wr + '% < ' + dynTh.minWinRate.toFixed(0) + '%'); }
      if (!meetsPF) { reasons.push('PF ' + pf + ' < ' + dynTh.minProfitFactor.toFixed(1)); }
      if (!meetsGap) { reasons.push('Gap ' + Math.abs(lastDiff).toFixed(2) + '% < ' + dynTh.minGap + '%'); }
      if (ev <= 0) { reasons.push('EV ' + ev.toFixed(3) + ' negative'); }
      return { 
        autoThresholds: autoThresholds, 
        action: 'SKIP', 
        perpetualAction: 'NO TRADE', 
        confidence: 0, 
        reasoning: reasons.join(', '), 
        pairsTrade: null,
        trendInfo: { trend: marketTrend, strength: trendStrength, reversal: reversalSignal }
      };
    }

    // Calculate base direction from gap
    let baseLong = lastDiff > 0 ? a1Info.symbol : a2Info.symbol;
    let baseShort = lastDiff > 0 ? a2Info.symbol : a1Info.symbol;

    // Determine final direction considering trend
    let finalLong = baseLong;
    let finalShort = baseShort;
    let directionSource = 'gap';
    let confidenceBoost = 0;

    // If trend strongly suggests a direction and it aligns with gap, boost confidence
    if (trendPreferredLong && trendPreferredShort) {
      if (trendPreferredLong === baseLong) {
        // Trend and gap agree - high confidence
        confidenceBoost = 15;
        directionSource = 'gap+trend aligned';
      } else if (trendStrength > 60) {
        // Strong trend overrides gap
        finalLong = trendPreferredLong;
        finalShort = trendPreferredShort;
        directionSource = 'trend override';
        confidenceBoost = 5;
      } else {
        // Trend and gap conflict - reduce confidence
        confidenceBoost = -10;
        directionSource = 'gap (trend conflict)';
      }
    }

    // Apply reversal adjustment
    if (reduceSize) {
      confidenceBoost = confidenceBoost - 15;
    }

    const expMove = lastDiff > mean ? -(Math.abs(lastDiff - mean) * mlRev) : Math.abs(lastDiff - mean) * mlRev;
    const targetGap = lastDiff + expMove;
    
    let conf = 60;
    if (meetsWR) { conf = conf + 15; }
    if (meetsPF) { conf = conf + 15; }
    if (meetsGap) { conf = conf + 10; }
    if (ev > 0) { conf = conf + 10; }
    conf = conf + confidenceBoost;
    conf = Math.max(20, Math.min(conf, 100));

    const reasoning = trendAdjustment + reversalWarning + 'ML: ' + finalShort + ' to underperform. ' + (mlRev * 100).toFixed(0) + '% reversion expected. Market: ' + marketTrend + ' (' + trendStrength + '%). Gap regime: ' + gapRegime + '. Direction: ' + directionSource + '.';

    return {
      autoThresholds: autoThresholds, 
      action: 'PAIRS', 
      perpetualAction: 'PAIRS TRADE', 
      confidence: conf.toFixed(1),
      reasoning: reasoning,
      pairsTrade: { 
        long: finalLong, 
        short: finalShort, 
        currentGap: lastDiff.toFixed(2), 
        targetGap: targetGap.toFixed(2), 
        expectedProfit: Math.abs(expMove).toFixed(2), 
        mlReversionFactor: (mlRev * 100).toFixed(0),
        directionSource: directionSource
      },
      currentGap: lastDiff.toFixed(2), 
      targetGap: targetGap.toFixed(2), 
      expectedMove: expMove.toFixed(2),
      riskLevel: reduceSize ? 'HIGH' : (std > 2 ? 'HIGH' : (std > 1 ? 'MEDIUM' : 'LOW')), 
      volatility: std.toFixed(2),
      mlReversionFactor: (mlRev * 100).toFixed(0), 
      mlEntryThreshold: mlTh, 
      mlHoldingPeriod: mlHP, 
      marketRegime: gapRegime,
      trendInfo: { 
        trend: marketTrend, 
        strength: trendStrength, 
        reversal: reversalSignal, 
        reversalStrength: reversalStrength,
        preferredLong: trendPreferredLong,
        preferredShort: trendPreferredShort
      },
      positionSizing: reduceSize ? 'REDUCED (50%)' : 'NORMAL'
    };
  };

  // ==================== DATA LOADING ====================

  const loadData = async () => {
    setLoading(true);
    const a1Info = getAssetInfo(asset1), a2Info = getAssetInfo(asset2);
    try {
      const details = getTimeframeDetails(timeframe, interval);
      const fi = details.interval;
      const limit = details.limit;
      
      // Fetch asset data
      const res1 = await fetch('https://api.binance.com/api/v3/klines?symbol=' + asset1 + '&interval=' + fi + '&limit=' + limit);
      const res2 = await fetch('https://api.binance.com/api/v3/klines?symbol=' + asset2 + '&interval=' + fi + '&limit=' + limit);
      const d1 = await res1.json(), d2 = await res2.json();
      
      // Always fetch BTC for trend analysis
      let btcData = d1;
      if (asset1 !== 'BTCUSDT') {
        const resBtc = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=' + fi + '&limit=' + limit);
        btcData = await resBtc.json();
      }
      
      if (!d1.length || !d2.length) throw new Error('No data');
      
      const res1_24 = await fetch('https://api.binance.com/api/v3/klines?symbol=' + asset1 + '&interval=1d&limit=2');
      const res2_24 = await fetch('https://api.binance.com/api/v3/klines?symbol=' + asset2 + '&interval=1d&limit=2');
      const d1_24 = await res1_24.json(), d2_24 = await res2_24.json();
      
      const sp1 = parseFloat(d1[0][4]), sp2 = parseFloat(d2[0][4]);
      const cp1 = parseFloat(d1[d1.length - 1][4]), cp2 = parseFloat(d2[d2.length - 1][4]);
      const pp1 = d1_24.length >= 2 ? parseFloat(d1_24[d1_24.length - 2][4]) : sp1;
      const pp2 = d2_24.length >= 2 ? parseFloat(d2_24[d2_24.length - 2][4]) : sp2;
      
      setPriceInfo({
        asset1: { current: cp1, previous: pp1, startPrice: sp1, change: ((cp1 - pp1) / pp1) * 100, changeTimeframe: ((cp1 - sp1) / sp1) * 100 },
        asset2: { current: cp2, previous: pp2, startPrice: sp2, change: ((cp2 - pp2) / pp2) * 100, changeTimeframe: ((cp2 - sp2) / sp2) * 100 }
      });
      
      // Extract BTC prices for trend analysis
      const btcPriceArray = btcData.map(k => parseFloat(k[4]));
      setBtcPrices(btcPriceArray);
      
      // Analyze market trend
      const trend = detectMarketTrend(btcPriceArray);
      setTrendAnalysis(trend);
      
      const chartData = [], minLen = Math.min(d1.length, d2.length);
      const dateFormat = limit > 90 ? { month: 'short', day: 'numeric' } : (fi.includes('m') || fi.includes('h') ? { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' } : { month: 'short', day: 'numeric' });
      
      for (let i = 0; i < minLen; i++) {
        const c1 = parseFloat(d1[i][4]), c2 = parseFloat(d2[i][4]);
        const ch1 = ((c1 - sp1) / sp1) * 100, ch2 = ((c2 - sp2) / sp2) * 100;
        chartData.push({ 
          date: new Date(d1[i][0]).toLocaleDateString('en-US', dateFormat), 
          asset1Daily: parseFloat(ch1.toFixed(2)), 
          asset2Daily: parseFloat(ch2.toFixed(2)), 
          diff: parseFloat((ch2 - ch1).toFixed(2)) 
        });
      }
      
      setData(chartData);
      
      // Analyze performance by regime
      const regimeStats = analyzePerformanceByRegime(chartData, btcPriceArray, a1Info.symbol, a2Info.symbol);
      
      const ml = runMLAnalysis(chartData);
      setMlMetrics(ml);
      const bt = runBacktest(chartData, ml);
      setBacktestResults(bt);
      const pred = generatePrediction(chartData, bt, a1Info, a2Info, ml, trend, regimeStats);
      setAlgoAnalysis({ prediction: pred, regimeStats: regimeStats });
      
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    loadData(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, interval, asset1, asset2]);

  useEffect(() => {
    if (data.length > 0 && backtestResults && priceInfo.asset1 && priceInfo.asset2 && trendAnalysis) {
      const ml = runMLAnalysis(data);
      setMlMetrics(ml);
      const a1Info = getAssetInfo(asset1), a2Info = getAssetInfo(asset2);
      const regimeStats = analyzePerformanceByRegime(data, btcPrices, a1Info.symbol, a2Info.symbol);
      const pred = generatePrediction(data, backtestResults, a1Info, a2Info, ml, trendAnalysis, regimeStats);
      setAlgoAnalysis({ prediction: pred, regimeStats: regimeStats });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceInfo]);

  const a1Info = getAssetInfo(asset1), a2Info = getAssetInfo(asset2);
  const avgDiff = data.length > 0 ? (data.reduce((s, d) => s + d.diff, 0) / data.length).toFixed(2) : 0;

  // ==================== RENDER ====================
  
  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'linear-gradient(to bottom right, #1f2937, #111827)', padding: '16px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ backgroundColor: '#1f2937', borderRadius: '12px 12px 0 0', border: '1px solid #374151', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', margin: 0 }}>ML Crypto Analyzer v3</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '13px', color: '#9ca3af' }}>Trend-Enhanced Trading</span>
              <span style={{ padding: '2px 8px', backgroundColor: '#8b5cf6', color: '#e9d5ff', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Brain size={10} />ML + TREND
              </span>
            </div>
          </div>
          <button onClick={loadData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: loading ? '#4b5563' : '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer' }}>
            <RefreshCw size={14} />Refresh
          </button>
        </div>

        {/* Market Trend Panel */}
        {trendAnalysis && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '20px' }}>
            <div style={{ borderRadius: '10px', padding: '16px', background: trendAnalysis.trend === 'UPTREND' ? 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(22,163,74,0.3))' : trendAnalysis.trend === 'DOWNTREND' ? 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(185,28,28,0.3))' : 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(217,119,6,0.3))', border: '2px solid ' + (trendAnalysis.trend === 'UPTREND' ? 'rgba(34,197,94,0.5)' : trendAnalysis.trend === 'DOWNTREND' ? 'rgba(239,68,68,0.5)' : 'rgba(251,191,36,0.5)') }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                {trendAnalysis.trend === 'UPTREND' ? <TrendingUp size={28} color="#34d399" /> : trendAnalysis.trend === 'DOWNTREND' ? <TrendingDown size={28} color="#f87171" /> : <AlertTriangle size={28} color="#fbbf24" />}
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: 0 }}>Market Trend: {trendAnalysis.trend}</h3>
                  <p style={{ fontSize: '12px', color: trendAnalysis.trend === 'UPTREND' ? '#6ee7b7' : trendAnalysis.trend === 'DOWNTREND' ? '#fca5a5' : '#fde68a', margin: 0 }}>{trendAnalysis.recommendation}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'white' }}>{trendAnalysis.strength}%</div>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>Strength</div>
                </div>
              </div>
              
              {/* Reversal Warning */}
              {trendAnalysis.reversalSignal !== 'NONE' && (
                <div style={{ padding: '10px', backgroundColor: 'rgba(251,191,36,0.2)', borderRadius: '6px', border: '1px solid rgba(251,191,36,0.4)', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={16} color="#fbbf24" />
                    <span style={{ color: '#fde68a', fontWeight: 'bold', fontSize: '13px' }}>{trendAnalysis.reversalSignal.replace('_', ' ')}</span>
                    <span style={{ color: '#9ca3af', fontSize: '12px' }}>Strength: {trendAnalysis.reversalStrength}%</span>
                  </div>
                </div>
              )}
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>RSI (14)</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: parseFloat(trendAnalysis.signals.rsi) > 70 ? '#f87171' : parseFloat(trendAnalysis.signals.rsi) < 30 ? '#34d399' : 'white' }}>{trendAnalysis.signals.rsi}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>MACD</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: parseFloat(trendAnalysis.signals.macdHistogram) > 0 ? '#34d399' : '#f87171' }}>{parseFloat(trendAnalysis.signals.macdHistogram) > 0 ? '▲' : '▼'}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>vs SMA20</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: trendAnalysis.signals.aboveSMA20 ? '#34d399' : '#f87171' }}>{trendAnalysis.signals.aboveSMA20 ? 'Above' : 'Below'}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>5-Bar Chg</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: parseFloat(trendAnalysis.signals.priceChange5) >= 0 ? '#34d399' : '#f87171' }}>{trendAnalysis.signals.priceChange5}%</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>20-Bar Chg</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: parseFloat(trendAnalysis.signals.priceChange20) >= 0 ? '#34d399' : '#f87171' }}>{trendAnalysis.signals.priceChange20}%</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>MA Align</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: trendAnalysis.signals.maAlignmentBullish ? '#34d399' : '#f87171' }}>{trendAnalysis.signals.maAlignmentBullish ? 'Bull' : 'Bear'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ML Metrics Panel */}
        {mlMetrics && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '20px' }}>
            <div style={{ borderRadius: '10px', padding: '16px', background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(109,40,217,0.3))', border: '2px solid rgba(139,92,246,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <Brain size={24} color="#a78bfa" />
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', margin: 0 }}>ML Gap Analysis</h3>
                  <p style={{ fontSize: '12px', color: '#c4b5fd', margin: 0 }}>{mlMetrics.reversionFactor?.samples || 0} samples</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: parseFloat(mlMetrics.overallConfidence) >= 50 ? '#34d399' : '#fbbf24' }}>{mlMetrics.overallConfidence}%</div>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>Confidence</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>Reversion</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#a78bfa' }}>{(mlMetrics.reversionFactor?.factor * 100).toFixed(0)}%</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>Entry σ</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#60a5fa' }}>{mlMetrics.entryThreshold?.threshold}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>Hold</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#34d399' }}>{mlMetrics.holdingPeriod?.periods} bar</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>Gap Regime</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: mlMetrics.marketRegime?.regime === 'MEAN_REVERTING' ? '#34d399' : '#fbbf24' }}>{mlMetrics.marketRegime?.regime?.replace('_', ' ')}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trade Signal */}
        {algoAnalysis?.prediction && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '20px' }}>
            {algoAnalysis.prediction.action !== 'SKIP' ? (
              <div style={{ borderRadius: '10px', padding: '20px', background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,78,59,0.3))', border: '2px solid rgba(16,185,129,0.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <Brain size={32} color="#34d399" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>{algoAnalysis.prediction.perpetualAction}</div>
                    <div style={{ fontSize: '12px', color: '#d1d5db' }}>
                      Confidence: {algoAnalysis.prediction.confidence}% | 
                      Direction: {algoAnalysis.prediction.pairsTrade?.directionSource || 'gap'}
                      {algoAnalysis.prediction.positionSizing === 'REDUCED (50%)' && <span style={{ color: '#fbbf24' }}> | ⚠️ REDUCED SIZE</span>}
                    </div>
                  </div>
                </div>
                
                <div style={{ padding: '12px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '6px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>🤖 ANALYSIS</div>
                  <p style={{ color: '#e5e7eb', fontSize: '13px', margin: 0 }}>{algoAnalysis.prediction.reasoning}</p>
                </div>

                {algoAnalysis.prediction.pairsTrade && (
                  <div style={{ padding: '14px', backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: '6px', border: '2px solid rgba(34,197,94,0.4)', marginBottom: '14px' }}>
                    <div style={{ fontSize: '12px', color: '#6ee7b7', fontWeight: 'bold', marginBottom: '10px' }}>📊 EXECUTE POSITIONS</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={{ padding: '10px', backgroundColor: 'rgba(16,185,129,0.2)', borderRadius: '4px' }}>
                        <div style={{ fontSize: '11px', color: '#6ee7b7' }}>LONG</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#34d399' }}>{algoAnalysis.prediction.pairsTrade.long}</div>
                      </div>
                      <div style={{ padding: '10px', backgroundColor: 'rgba(239,68,68,0.2)', borderRadius: '4px' }}>
                        <div style={{ fontSize: '11px', color: '#fca5a5' }}>SHORT</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f87171' }}>{algoAnalysis.prediction.pairsTrade.short}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: '10px', padding: '8px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '4px', fontSize: '12px' }}>
                      <div style={{ color: '#d1d5db' }}>Expected: <span style={{ color: '#34d399', fontWeight: 'bold' }}>+{algoAnalysis.prediction.pairsTrade.expectedProfit}%</span></div>
                      <div style={{ color: '#9ca3af' }}>Gap: {algoAnalysis.prediction.pairsTrade.currentGap}% → {algoAnalysis.prediction.pairsTrade.targetGap}%</div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '10px', color: '#9ca3af' }}>Gap</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>{algoAnalysis.prediction.currentGap}%</div>
                  </div>
                  <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '10px', color: '#9ca3af' }}>Target</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#34d399' }}>{algoAnalysis.prediction.targetGap}%</div>
                  </div>
                  <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '10px', color: '#9ca3af' }}>Risk</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: algoAnalysis.prediction.riskLevel === 'HIGH' ? '#f87171' : '#34d399' }}>{algoAnalysis.prediction.riskLevel}</div>
                  </div>
                  <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '10px', color: '#9ca3af' }}>Sizing</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: algoAnalysis.prediction.positionSizing === 'REDUCED (50%)' ? '#fbbf24' : '#34d399' }}>{algoAnalysis.prediction.positionSizing || 'NORMAL'}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ borderRadius: '10px', padding: '20px', background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(127,29,29,0.2))', border: '2px solid rgba(239,68,68,0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '32px' }}>🚫</div>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f87171' }}>NO TRADE</div>
                    <div style={{ fontSize: '12px', color: '#fca5a5' }}>Conditions not met</div>
                  </div>
                </div>
                <div style={{ padding: '12px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '13px', color: '#e5e7eb' }}>{algoAnalysis.prediction.reasoning}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Regime Performance Stats */}
        {algoAnalysis?.regimeStats && (algoAnalysis.regimeStats.uptrendStats || algoAnalysis.regimeStats.downtrendStats) && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '20px' }}>
            <div style={{ borderRadius: '10px', padding: '16px', backgroundColor: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#fbbf24', margin: '0 0 12px 0' }}>📊 Historical Performance by Market Regime</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {algoAnalysis.regimeStats.uptrendStats && (
                  <div style={{ padding: '12px', backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: '6px', border: '1px solid rgba(34,197,94,0.3)' }}>
                    <div style={{ fontSize: '12px', color: '#6ee7b7', fontWeight: 'bold', marginBottom: '8px' }}>📈 UPTREND ({algoAnalysis.regimeStats.uptrendStats.periods} periods)</div>
                    <div style={{ fontSize: '12px', color: '#d1d5db' }}>
                      {a1Info.symbol} wins: {algoAnalysis.regimeStats.uptrendStats.a1WinRate}%<br/>
                      {a2Info.symbol} wins: {algoAnalysis.regimeStats.uptrendStats.a2WinRate}%<br/>
                      <span style={{ color: '#34d399', fontWeight: 'bold' }}>Favors: {algoAnalysis.regimeStats.uptrendStats.favors}</span>
                    </div>
                  </div>
                )}
                {algoAnalysis.regimeStats.downtrendStats && (
                  <div style={{ padding: '12px', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <div style={{ fontSize: '12px', color: '#fca5a5', fontWeight: 'bold', marginBottom: '8px' }}>📉 DOWNTREND ({algoAnalysis.regimeStats.downtrendStats.periods} periods)</div>
                    <div style={{ fontSize: '12px', color: '#d1d5db' }}>
                      {a1Info.symbol} wins: {algoAnalysis.regimeStats.downtrendStats.a1WinRate}%<br/>
                      {a2Info.symbol} wins: {algoAnalysis.regimeStats.downtrendStats.a2WinRate}%<br/>
                      <span style={{ color: '#f87171', fontWeight: 'bold' }}>Favors: {algoAnalysis.regimeStats.downtrendStats.favors}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Backtest */}
        {backtestResults && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '20px' }}>
            <div style={{ borderRadius: '10px', padding: '16px', backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <CheckCircle size={18} color="#60a5fa" />
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'white', margin: 0 }}>Backtest ({backtestResults.entryThresholdUsed}σ)</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>Win Rate</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: parseFloat(backtestResults.winRate) >= 50 ? '#34d399' : '#f87171' }}>{backtestResults.winRate}%</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>Trades</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>{backtestResults.totalTrades}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>PF</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: parseFloat(backtestResults.profitFactor) >= 1 ? '#34d399' : '#fbbf24' }}>{backtestResults.profitFactor}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>Avg W</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#34d399' }}>+{backtestResults.avgWin}%</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>Avg L</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f87171' }}>-{backtestResults.avgLoss}%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Asset 1</label>
              <select value={asset1} onChange={(e) => setAsset1(e.target.value)} style={{ width: '100%', padding: '8px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '6px', fontSize: '13px' }}>
                {CRYPTO_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Asset 2</label>
              <select value={asset2} onChange={(e) => setAsset2(e.target.value)} style={{ width: '100%', padding: '8px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '6px', fontSize: '13px' }}>
                {CRYPTO_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Interval</label>
              <select value={interval} onChange={(e) => setInterval(e.target.value)} style={{ width: '100%', padding: '8px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '6px', fontSize: '13px' }}>
                {INTERVAL_OPTIONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Timeframe */}
        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '10px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ color: '#9ca3af', fontSize: '12px' }}>TF:</span>
            {['1D', '7D', '1M', '3M', '6M', '1Y', 'YTD'].map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)} style={{ padding: '5px 12px', borderRadius: '5px', border: 'none', cursor: 'pointer', backgroundColor: timeframe === tf ? '#2563eb' : '#374151', color: timeframe === tf ? 'white' : '#d1d5db', fontWeight: '500', fontSize: '12px' }}>{tf}</button>
            ))}
          </div>
        </div>

        {/* Charts */}
        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '20px' }}>
          <h2 style={{ color: 'white', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>Performance</h2>
          {loading ? (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="asset1Daily" stroke={a1Info.color} strokeWidth={2} name={a1Info.symbol} dot={false} />
                <Line type="monotone" dataKey="asset2Daily" stroke={a2Info.color} strokeWidth={2} name={a2Info.symbol} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', borderBottom: '1px solid #374151', borderRadius: '0 0 12px 12px', padding: '20px' }}>
          <h2 style={{ color: 'white', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>Gap (Mean: {avgDiff}%)</h2>
          {loading ? (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="diff" stroke="#10b981" strokeWidth={2} name="Gap" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
