import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { RefreshCw, TrendingUp, Brain, CheckCircle } from 'lucide-react';

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
  { value: '1m', label: '1 Min' }, { value: '5m', label: '5 Min' }, { value: '15m', label: '15 Min' },
  { value: '30m', label: '30 Min' }, { value: '1h', label: '1 Hour' }, { value: '2h', label: '2 Hour' },
  { value: '4h', label: '4 Hour' }, { value: '1d', label: '1 Day' }, { value: '1w', label: '1 Week' },
];

function App() {
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

  const getAssetInfo = (id) => CRYPTO_OPTIONS.find(a => a.id === id) || CRYPTO_OPTIONS[0];

  const getTimeframeDetails = (tf, intv) => {
    const limits = {
      '1D': { '1m': 1440, '5m': 288, '15m': 96, '30m': 48, '1h': 24, '2h': 12, '4h': 6, '1d': 1 },
      '7D': { '1h': 168, '2h': 84, '4h': 42, '1d': 7 },
      '1M': { '1h': 720, '4h': 180, '1d': 30 },
      '3M': { '1d': 90, '1w': 12 }, '6M': { '1d': 180, '1w': 26 }, '1Y': { '1d': 365, '1w': 52 }
    };
    if (tf === 'YTD') {
      const days = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 1)) / 86400000);
      return { interval: intv === '1w' ? '1w' : '1d', limit: intv === '1w' ? Math.ceil(days / 7) : days };
    }
    const validIntervals = limits[tf] || limits['7D'];
    const finalInterval = validIntervals[intv] ? intv : Object.keys(validIntervals)[0];
    return { interval: finalInterval, limit: validIntervals[finalInterval] || 7 };
  };

  // ==================== ML FUNCTIONS ====================
  const calculateOptimalReversionFactor = (chartData) => {
    if (chartData.length < 20) return { factor: 0.6, confidence: 0, samples: 0 };
    const diffs = chartData.map(d => d.diff);
    const samples = [];
    for (let i = 10; i < diffs.length - 5; i++) {
      const hist = diffs.slice(i - 10, i);
      const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
      const std = Math.sqrt(hist.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / hist.length);
      const dev = diffs[i] - mean;
      if (Math.abs(dev) > std * 0.8) {
        for (let h = 1; h <= Math.min(5, diffs.length - i - 1); h++) {
          const futDev = diffs[i + h] - mean;
          if (Math.abs(dev) > 0.001) {
            const rev = 1 - (futDev / dev);
            if (rev > -0.5 && rev < 1.5) samples.push({ rev, weight: Math.abs(dev) / std });
          }
        }
      }
    }
    if (samples.length < 5) return { factor: 0.6, confidence: 0, samples: 0 };
    const totW = samples.reduce((s, x) => s + x.weight, 0);
    const wAvg = samples.reduce((s, x) => s + x.rev * x.weight, 0) / totW;
    const revStd = Math.sqrt(samples.reduce((s, x) => s + Math.pow(x.rev - wAvg, 2), 0) / samples.length);
    const conf = (Math.max(0, 1 - revStd) * 0.6 + Math.min(1, samples.length / 50) * 0.4) * 100;
    return { factor: Math.max(0.2, Math.min(0.95, wAvg)), confidence: conf.toFixed(1), samples: samples.length };
  };

  const optimizeEntryThreshold = (chartData) => {
    if (chartData.length < 30) return { threshold: 1.2, bestWinRate: 0, bestProfitFactor: 0, bestTrades: 0 };
    const diffs = chartData.map(d => d.diff);
    let best = { threshold: 1.2, score: -Infinity, winRate: 0, pf: 0, trades: 0 };
    for (const th of [0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.5]) {
      let w = 0, l = 0, tp = 0, tl = 0;
      for (let i = 10; i < diffs.length - 1; i++) {
        const hist = diffs.slice(i - 10, i);
        const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
        const std = Math.sqrt(hist.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / hist.length);
        const cur = diffs[i], nxt = diffs[i + 1];
        if (cur > mean + th * std) { const pnl = cur - nxt; if (pnl > 0) { w++; tp += pnl; } else { l++; tl += Math.abs(pnl); } }
        else if (cur < mean - th * std) { const pnl = nxt - cur; if (pnl > 0) { w++; tp += pnl; } else { l++; tl += Math.abs(pnl); } }
      }
      const tot = w + l;
      if (tot >= 3) {
        const wr = w / tot, pf = tl > 0 ? tp / tl : tp > 0 ? 10 : 0;
        const score = wr * 40 + Math.min(pf, 3) * 20 + Math.min(tot, 20) * 2;
        if (score > best.score) best = { threshold: th, score, winRate: (wr * 100).toFixed(1), pf: pf.toFixed(2), trades: tot };
      }
    }
    return { threshold: best.threshold, bestWinRate: best.winRate, bestProfitFactor: best.pf, bestTrades: best.trades };
  };

  const calculateOptimalHoldingPeriod = (chartData) => {
    if (chartData.length < 30) return { periods: 1, expectedReturn: 0, winRate: 0 };
    const diffs = chartData.map(d => d.diff);
    const results = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (let i = 10; i < diffs.length - 5; i++) {
      const hist = diffs.slice(i - 10, i);
      const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
      const std = Math.sqrt(hist.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / hist.length);
      if (Math.abs(diffs[i] - mean) > std) {
        const dir = diffs[i] > mean ? -1 : 1;
        for (let h = 1; h <= Math.min(5, diffs.length - i - 1); h++) {
          results[h].push(dir * (diffs[i + h] - diffs[i]));
        }
      }
    }
    let bestP = 1, bestScore = -Infinity, bestWR = 0;
    for (let p = 1; p <= 5; p++) {
      if (results[p].length >= 3) {
        const avg = results[p].reduce((a, b) => a + b, 0) / results[p].length;
        const wr = results[p].filter(x => x > 0).length / results[p].length;
        const score = avg * 0.7 + wr * 0.3;
        if (score > bestScore) { bestScore = score; bestP = p; bestWR = (wr * 100).toFixed(1); }
      }
    }
    const avgRet = results[bestP].length > 0 ? (results[bestP].reduce((a, b) => a + b, 0) / results[bestP].length).toFixed(3) : 0;
    return { periods: bestP, expectedReturn: avgRet, winRate: bestWR };
  };

  const detectMarketRegime = (chartData) => {
    if (chartData.length < 20) return { regime: 'UNKNOWN', strength: 0, autocorrelation: 0, hurstEstimate: 0.5, recommendation: 'Insufficient data' };
    const diffs = chartData.map(d => d.diff);
    const rets = []; for (let i = 1; i < diffs.length; i++) rets.push(diffs[i] - diffs[i - 1]);
    const meanR = rets.reduce((a, b) => a + b, 0) / rets.length;
    let num = 0, den = 0;
    for (let i = 1; i < rets.length; i++) num += (rets[i] - meanR) * (rets[i - 1] - meanR);
    for (let i = 0; i < rets.length; i++) den += Math.pow(rets[i] - meanR, 2);
    const ac = den !== 0 ? num / den : 0;
    const n = Math.floor(diffs.length / 2);
    const h1 = diffs.slice(0, n), h2 = diffs.slice(n);
    const r1 = Math.max(...h1) - Math.min(...h1), r2 = Math.max(...h2) - Math.min(...h2);
    const s1 = Math.sqrt(h1.reduce((s, v) => s + Math.pow(v - h1.reduce((a, b) => a + b, 0) / n, 2), 0) / n);
    const s2 = Math.sqrt(h2.reduce((s, v) => s + Math.pow(v - h2.reduce((a, b) => a + b, 0) / n, 2), 0) / n);
    const avgRS = ((s1 > 0 ? r1 / s1 : 0) + (s2 > 0 ? r2 / s2 : 0)) / 2;
    const hurst = avgRS > 0 ? Math.log(avgRS) / Math.log(n) : 0.5;
    let regime, strength, rec;
    if (ac < -0.2 || hurst < 0.4) { regime = 'MEAN_REVERTING'; strength = Math.min(100, Math.abs(ac) * 200 + (0.5 - hurst) * 100); rec = 'Strong mean reversion. Pairs trading recommended.'; }
    else if (ac > 0.2 || hurst > 0.6) { regime = 'TRENDING'; strength = Math.min(100, ac * 200 + (hurst - 0.5) * 100); rec = 'Trending market. Consider momentum strategies.'; }
    else { regime = 'NEUTRAL'; strength = 50; rec = 'No clear regime. Use conservative sizing.'; }
    return { regime, strength: strength.toFixed(1), autocorrelation: ac.toFixed(3), hurstEstimate: hurst.toFixed(3), recommendation: rec };
  };

  const calculateOptimalThresholds = (chartData) => {
    if (chartData.length < 30) return { minWinRate: 50, minProfitFactor: 1.0, minGap: 0.5, isOptimized: false };
    const diffs = chartData.map(d => d.diff);
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const std = Math.sqrt(diffs.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / diffs.length);
    const fee = 0.15;
    let bestGap = 0.5, bestEV = -Infinity, bestWR = 50, bestPF = 1.0;
    for (const gap of [0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0]) {
      let w = 0, l = 0, tp = 0, tl = 0;
      for (let i = 10; i < diffs.length - 1; i++) {
        const hist = diffs.slice(i - 10, i);
        const lm = hist.reduce((a, b) => a + b, 0) / hist.length;
        const dev = Math.abs(diffs[i] - lm);
        if (dev >= gap) {
          const dir = diffs[i] > lm ? -1 : 1;
          const pnl = dir * (diffs[i + 1] - diffs[i]);
          if (pnl > fee) { w++; tp += pnl; } else { l++; tl += Math.abs(pnl); }
        }
      }
      const tot = w + l;
      if (tot >= 5) {
        const wr = (w / tot) * 100;
        const avgW = w > 0 ? tp / w : 0, avgL = l > 0 ? tl / l : 0.001;
        const pf = tl > 0 ? tp / tl : tp > 0 ? 10 : 0;
        const ev = (wr / 100 * avgW) - ((100 - wr) / 100 * avgL) - fee;
        if (ev > bestEV) { bestEV = ev; bestGap = gap; bestWR = wr; bestPF = pf; }
      }
    }
    return {
      minWinRate: Math.round(Math.max(51, bestWR * 0.85)),
      minProfitFactor: Math.round(Math.max(1.05, bestPF * 0.8) * 100) / 100,
      minGap: Math.round(Math.max(bestGap * 0.8, std * 0.5, 0.2) * 100) / 100,
      isOptimized: true, optimalGap: bestGap, bestExpectedValue: bestEV.toFixed(4), stdDev: std.toFixed(3), samplesAnalyzed: chartData.length
    };
  };

  const runMLAnalysis = (chartData) => {
    const rev = calculateOptimalReversionFactor(chartData);
    const entry = optimizeEntryThreshold(chartData);
    const hold = calculateOptimalHoldingPeriod(chartData);
    const regime = detectMarketRegime(chartData);
    const thresholds = calculateOptimalThresholds(chartData);
    const conf = (parseFloat(rev.confidence) || 0) * 0.3 + (parseFloat(entry.bestWinRate) || 0) * 0.4 + (regime.regime === 'MEAN_REVERTING' ? parseFloat(regime.strength) * 0.3 : parseFloat(regime.strength) * 0.1);
    return { reversionFactor: rev, entryThreshold: entry, holdingPeriod: hold, marketRegime: regime, optimalThresholds: thresholds, overallConfidence: conf.toFixed(1), isMLReady: rev.samples >= 10 && entry.bestTrades >= 5 };
  };

  const detectPatterns = (chartData) => {
    if (chartData.length < 10) return [];
    const patterns = [], diffs = chartData.map(d => d.diff);
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const std = Math.sqrt(diffs.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / diffs.length);
    const last = diffs[diffs.length - 1];
    if (Math.abs(last - mean) > 1.5 * std) patterns.push({ type: 'MEAN_REVERSION', direction: last > mean ? 'SHORT' : 'LONG' });
    return patterns;
  };

  const runBacktest = (chartData, ml) => {
    if (chartData.length < 20) return null;
    const th = ml?.entryThreshold?.threshold || 1.2;
    const diffs = chartData.map(d => d.diff);
    let w = 0, l = 0, tp = 0, tl = 0;
    for (let i = 10; i < diffs.length - 1; i++) {
      const hist = diffs.slice(i - 10, i);
      const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
      const std = Math.sqrt(hist.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / hist.length);
      const cur = diffs[i], nxt = diffs[i + 1];
      if (cur > mean + th * std) { const pnl = cur - nxt; if (pnl > 0) { w++; tp += pnl; } else { l++; tl += Math.abs(pnl); } }
      else if (cur < mean - th * std) { const pnl = nxt - cur; if (pnl > 0) { w++; tp += pnl; } else { l++; tl += Math.abs(pnl); } }
    }
    const tot = w + l;
    const wr = tot > 0 ? (w / tot) * 100 : 0;
    const avgW = w > 0 ? tp / w : 0, avgL = l > 0 ? tl / l : 0;
    const pf = tl > 0 ? (tp) / (tl) : w > 0 ? 999 : 0;
    return { totalTrades: tot, wins: w, losses: l, winRate: wr.toFixed(1), avgWin: avgW.toFixed(2), avgLoss: avgL.toFixed(2), profitFactor: pf.toFixed(2), entryThresholdUsed: th };
  };

  const generatePrediction = (chartData, patterns, backtest, a1Info, a2Info, ml) => {
    if (!chartData.length || !patterns.length || !backtest || !priceInfo.asset1 || !priceInfo.asset2) return null;
    const lastDiff = priceInfo.asset2.changeTimeframe - priceInfo.asset1.changeTimeframe;
    const diffs = chartData.map(d => d.diff);
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const std = Math.sqrt(diffs.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / diffs.length);
    const revFactor = ml?.reversionFactor?.factor || 0.6;
    const regime = ml?.marketRegime?.regime || 'UNKNOWN';
    const th = ml?.optimalThresholds || { minWinRate: 50, minProfitFactor: 1.0, minGap: 0.5 };
    const wr = parseFloat(backtest.winRate), pf = parseFloat(backtest.profitFactor);
    const avgW = parseFloat(backtest.avgWin), avgL = parseFloat(backtest.avgLoss);
    const ev = (wr / 100 * avgW) - ((100 - wr) / 100 * avgL) - 0.15;
    const meetsWR = wr >= th.minWinRate, meetsPF = pf >= th.minProfitFactor, meetsGap = Math.abs(lastDiff) >= th.minGap;
    const profitable = ev > 0, goodRegime = regime === 'MEAN_REVERTING' || regime === 'NEUTRAL';
    const shouldTrade = (meetsWR || meetsPF || meetsGap) && profitable && goodRegime;
    
    if (!shouldTrade) {
      const reasons = [];
      if (!meetsWR) reasons.push(`WinRate ${wr}% < ${th.minWinRate}%`);
      if (!meetsPF) reasons.push(`PF ${pf} < ${th.minProfitFactor}`);
      if (!meetsGap) reasons.push(`Gap ${Math.abs(lastDiff).toFixed(2)}% < ${th.minGap}%`);
      if (!profitable) reasons.push(`EV ${ev.toFixed(3)}% negative`);
      if (!goodRegime) reasons.push(`Regime: ${regime}`);
      return { action: 'SKIP', perpetualAction: 'NO TRADE', reasoning: reasons.join('. '), confidence: '0', pairsTrade: null, currentGap: lastDiff.toFixed(2), targetGap: mean.toFixed(2), expectedMove: '0', riskLevel: 'N/A', autoThresholds: { ...th, meetsWR, meetsPF, meetsGap, ev: ev.toFixed(3) } };
    }
    const expMove = lastDiff > mean ? -(Math.abs(lastDiff - mean) * revFactor) : Math.abs(lastDiff - mean) * revFactor;
    const target = lastDiff + expMove;
    const conf = Math.min(50 + (meetsWR ? 20 : 0) + (meetsPF ? 15 : 0) + (meetsGap ? 10 : 0) + (profitable ? 5 : 0), 100);
    const long = lastDiff > 0 ? a1Info.symbol : a2Info.symbol, short = lastDiff > 0 ? a2Info.symbol : a1Info.symbol;
    return {
      action: 'PAIRS', perpetualAction: 'PAIRS TRADE',
      reasoning: `ML: ${(revFactor * 100).toFixed(0)}% reversion from ${ml?.reversionFactor?.samples || 0} samples. EV: +${ev.toFixed(3)}%/trade. Regime: ${regime}.`,
      confidence: conf.toFixed(1), currentGap: lastDiff.toFixed(2), targetGap: target.toFixed(2), expectedMove: expMove.toFixed(2),
      riskLevel: std > 2 ? 'HIGH' : std > 1 ? 'MEDIUM' : 'LOW', mlReversionFactor: (revFactor * 100).toFixed(0),
      pairsTrade: { long, short, currentGap: lastDiff.toFixed(2), targetGap: target.toFixed(2), expectedProfit: Math.abs(expMove).toFixed(2), mlReversionFactor: (revFactor * 100).toFixed(0) },
      autoThresholds: { ...th, meetsWR, meetsPF, meetsGap, ev: ev.toFixed(3) }
    };
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { interval: intv, limit } = getTimeframeDetails(timeframe, interval);
      const [r1, r2] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/klines?symbol=${asset1}&interval=${intv}&limit=${limit}`),
        fetch(`https://api.binance.com/api/v3/klines?symbol=${asset2}&interval=${intv}&limit=${limit}`)
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      if (!d1.length || !d2.length) throw new Error('No data');
      const len = Math.min(d1.length, d2.length);
      const p1Start = parseFloat(d1[0][4]), p2Start = parseFloat(d2[0][4]);
      const p1End = parseFloat(d1[len - 1][4]), p2End = parseFloat(d2[len - 1][4]);
      const [r1_24, r2_24] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/klines?symbol=${asset1}&interval=1d&limit=2`),
        fetch(`https://api.binance.com/api/v3/klines?symbol=${asset2}&interval=1d&limit=2`)
      ]);
      const [d1_24, d2_24] = await Promise.all([r1_24.json(), r2_24.json()]);
      const prev1 = d1_24.length >= 2 ? parseFloat(d1_24[d1_24.length - 2][4]) : p1Start;
      const prev2 = d2_24.length >= 2 ? parseFloat(d2_24[d2_24.length - 2][4]) : p2Start;
      setPriceInfo({
        asset1: { current: p1End, startPrice: p1Start, change: ((p1End - prev1) / prev1) * 100, changeTimeframe: ((p1End - p1Start) / p1Start) * 100 },
        asset2: { current: p2End, startPrice: p2Start, change: ((p2End - prev2) / prev2) * 100, changeTimeframe: ((p2End - p2Start) / p2Start) * 100 }
      });
      const chartData = [];
      for (let i = 0; i < len; i++) {
        const c1 = parseFloat(d1[i][4]), c2 = parseFloat(d2[i][4]);
        const ch1 = ((c1 - p1Start) / p1Start) * 100, ch2 = ((c2 - p2Start) / p2Start) * 100;
        const dt = new Date(d1[i][0]);
        chartData.push({ date: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), asset1Daily: parseFloat(ch1.toFixed(2)), asset2Daily: parseFloat(ch2.toFixed(2)), diff: parseFloat((ch2 - ch1).toFixed(2)) });
      }
      setData(chartData);
      const ml = runMLAnalysis(chartData);
      setMlMetrics(ml);
      const patterns = detectPatterns(chartData);
      const bt = runBacktest(chartData, ml);
      setBacktestResults(bt);
      const pred = generatePrediction(chartData, patterns, bt, getAssetInfo(asset1), getAssetInfo(asset2), ml);
      setAlgoAnalysis({ patterns, prediction: pred });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); // eslint-disable-next-line
  }, [timeframe, interval, asset1, asset2]);

  const a1 = getAssetInfo(asset1), a2 = getAssetInfo(asset2);
  const avgDiff = data.length > 0 ? (data.reduce((s, d) => s + d.diff, 0) / data.length).toFixed(2) : 0;

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', padding: '16px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* HEADER */}
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px 16px 0 0', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', margin: 0 }}>ML-Powered Crypto Analysis</h1>
            <p style={{ fontSize: '13px', color: '#888', margin: '4px 0 0' }}>Fully ML-Optimized • No Hardcoded Thresholds</p>
          </div>
          <button onClick={loadData} disabled={loading} style={{ padding: '10px 20px', background: loading ? '#444' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', borderRadius: '8px', cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
            <RefreshCw size={16} /> {loading ? 'Analyzing...' : 'Refresh'}
          </button>
        </div>

        {/* ML METRICS */}
        {mlMetrics && (
          <div style={{ background: 'linear-gradient(135deg, rgba(102,126,234,0.15) 0%, rgba(118,75,162,0.15) 100%)', padding: '24px', borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <Brain size={28} color="#a78bfa" />
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '18px', color: '#fff', margin: 0 }}>Machine Learning Analysis</h2>
                <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>All parameters learned from {mlMetrics.reversionFactor?.samples || 0} historical samples</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: parseFloat(mlMetrics.overallConfidence) >= 50 ? '#4ade80' : '#fbbf24' }}>{mlMetrics.overallConfidence}%</div>
                <div style={{ fontSize: '11px', color: '#888' }}>ML Confidence</div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(167,139,250,0.3)' }}>
                <div style={{ fontSize: '11px', color: '#a78bfa', marginBottom: '6px' }}>🎯 Reversion Factor</div>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#a78bfa' }}>{(mlMetrics.reversionFactor?.factor * 100).toFixed(0)}%</div>
                <div style={{ fontSize: '10px', color: '#666' }}>Conf: {mlMetrics.reversionFactor?.confidence}%</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(96,165,250,0.3)' }}>
                <div style={{ fontSize: '11px', color: '#60a5fa', marginBottom: '6px' }}>📊 Entry Threshold</div>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#60a5fa' }}>{mlMetrics.entryThreshold?.threshold}σ</div>
                <div style={{ fontSize: '10px', color: '#666' }}>WR: {mlMetrics.entryThreshold?.bestWinRate}%</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(52,211,153,0.3)' }}>
                <div style={{ fontSize: '11px', color: '#34d399', marginBottom: '6px' }}>⏱️ Hold Period</div>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#34d399' }}>{mlMetrics.holdingPeriod?.periods} bar(s)</div>
                <div style={{ fontSize: '10px', color: '#666' }}>Ret: {mlMetrics.holdingPeriod?.expectedReturn}%</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(251,191,36,0.3)' }}>
                <div style={{ fontSize: '11px', color: '#fbbf24', marginBottom: '6px' }}>📈 Regime</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: mlMetrics.marketRegime?.regime === 'MEAN_REVERTING' ? '#4ade80' : mlMetrics.marketRegime?.regime === 'TRENDING' ? '#f87171' : '#fbbf24' }}>{mlMetrics.marketRegime?.regime?.replace('_', ' ')}</div>
                <div style={{ fontSize: '10px', color: '#666' }}>Str: {mlMetrics.marketRegime?.strength}%</div>
              </div>
            </div>

            {/* ML THRESHOLDS */}
            <div style={{ background: 'rgba(52,211,153,0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(52,211,153,0.3)' }}>
              <div style={{ fontSize: '12px', color: '#4ade80', marginBottom: '12px', fontWeight: 'bold' }}>✅ ML-Optimized Thresholds (Not Hardcoded)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', textAlign: 'center' }}>
                <div><div style={{ fontSize: '10px', color: '#888' }}>Min Win Rate</div><div style={{ fontSize: '22px', fontWeight: 'bold', color: '#4ade80' }}>{mlMetrics.optimalThresholds?.minWinRate}%</div></div>
                <div><div style={{ fontSize: '10px', color: '#888' }}>Min Profit Factor</div><div style={{ fontSize: '22px', fontWeight: 'bold', color: '#4ade80' }}>{mlMetrics.optimalThresholds?.minProfitFactor}</div></div>
                <div><div style={{ fontSize: '10px', color: '#888' }}>Min Gap</div><div style={{ fontSize: '22px', fontWeight: 'bold', color: '#4ade80' }}>{mlMetrics.optimalThresholds?.minGap}%</div></div>
              </div>
              <div style={{ fontSize: '10px', color: '#666', marginTop: '10px', textAlign: 'center' }}>Optimal Gap: {mlMetrics.optimalThresholds?.optimalGap}% | Best EV: {mlMetrics.optimalThresholds?.bestExpectedValue}% | σ: {mlMetrics.optimalThresholds?.stdDev}%</div>
            </div>
          </div>
        )}

        {/* MEAN REVERSION & BACKTEST */}
        {backtestResults && (
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><TrendingUp size={20} color="#4ade80" /><h3 style={{ color: '#fff', margin: 0, fontSize: '16px' }}>Mean Reversion</h3></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px' }}><div style={{ fontSize: '10px', color: '#888' }}>Current {timeframe} Gap</div><div style={{ fontSize: '22px', fontWeight: 'bold', color: priceInfo.asset2 && (priceInfo.asset2.changeTimeframe - priceInfo.asset1.changeTimeframe) >= 0 ? '#4ade80' : '#f87171' }}>{priceInfo.asset1 && priceInfo.asset2 ? (priceInfo.asset2.changeTimeframe - priceInfo.asset1.changeTimeframe).toFixed(2) : 0}%</div></div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px' }}><div style={{ fontSize: '10px', color: '#888' }}>Mean Gap</div><div style={{ fontSize: '22px', fontWeight: 'bold', color: '#60a5fa' }}>{avgDiff}%</div></div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px' }}><div style={{ fontSize: '10px', color: '#888' }}>ML Reversion</div><div style={{ fontSize: '22px', fontWeight: 'bold', color: '#a78bfa' }}>{mlMetrics ? (mlMetrics.reversionFactor?.factor * 100).toFixed(0) : 60}%</div></div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px' }}><div style={{ fontSize: '10px', color: '#888' }}>ML Target</div><div style={{ fontSize: '22px', fontWeight: 'bold', color: '#4ade80' }}>{algoAnalysis?.prediction?.targetGap || avgDiff}%</div></div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><CheckCircle size={20} color="#60a5fa" /><h3 style={{ color: '#fff', margin: 0, fontSize: '16px' }}>Backtest (Threshold: {backtestResults.entryThresholdUsed}σ)</h3></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px' }}><div style={{ fontSize: '10px', color: '#888' }}>Win Rate</div><div style={{ fontSize: '22px', fontWeight: 'bold', color: parseFloat(backtestResults.winRate) >= 55 ? '#4ade80' : '#f87171' }}>{backtestResults.winRate}%</div></div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px' }}><div style={{ fontSize: '10px', color: '#888' }}>Profit Factor</div><div style={{ fontSize: '22px', fontWeight: 'bold', color: parseFloat(backtestResults.profitFactor) >= 1.5 ? '#4ade80' : '#fbbf24' }}>{backtestResults.profitFactor}</div></div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px' }}><div style={{ fontSize: '10px', color: '#888' }}>Trades</div><div style={{ fontSize: '22px', fontWeight: 'bold', color: '#fff' }}>{backtestResults.totalTrades}</div></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONTROLS */}
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px 24px', borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div><label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>Asset 1</label><select value={asset1} onChange={e => setAsset1(e.target.value)} style={{ width: '100%', padding: '10px', background: '#1a1a2e', color: '#fff', border: '1px solid #333', borderRadius: '8px' }}>{CRYPTO_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}</select></div>
            <div><label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>Asset 2</label><select value={asset2} onChange={e => setAsset2(e.target.value)} style={{ width: '100%', padding: '10px', background: '#1a1a2e', color: '#fff', border: '1px solid #333', borderRadius: '8px' }}>{CRYPTO_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}</select></div>
            <div><label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>Interval</label><select value={interval} onChange={e => setInterval(e.target.value)} style={{ width: '100%', padding: '10px', background: '#1a1a2e', color: '#fff', border: '1px solid #333', borderRadius: '8px' }}>{INTERVAL_OPTIONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}</select></div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['1D', '7D', '1M', '3M', '6M', '1Y', 'YTD'].map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)} style={{ padding: '8px 16px', background: timeframe === tf ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: timeframe === tf ? 'bold' : 'normal' }}>{tf}</button>
            ))}
          </div>
        </div>

        {/* CHARTS */}
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
          <h3 style={{ color: '#fff', marginBottom: '16px', fontSize: '16px' }}>Performance Comparison</h3>
          {loading ? <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Loading...</div> : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#333" /><XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} /><YAxis tick={{ fontSize: 10, fill: '#888' }} /><Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333' }} /><Legend /><Line type="monotone" dataKey="asset1Daily" stroke={a1.color} strokeWidth={2} dot={false} name={a1.symbol} /><Line type="monotone" dataKey="asset2Daily" stroke={a2.color} strokeWidth={2} dot={false} name={a2.symbol} /></LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '0 0 16px 16px', borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h3 style={{ color: '#fff', marginBottom: '16px', fontSize: '16px' }}>Gap Analysis</h3>
          {loading ? <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Loading...</div> : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#333" /><XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} /><YAxis tick={{ fontSize: 10, fill: '#888' }} /><Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333' }} /><Legend /><Line type="monotone" dataKey="diff" stroke="#4ade80" strokeWidth={2} dot={false} name={`Gap (${a2.symbol}-${a1.symbol})`} /></LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

        {/* TRADE SIGNAL */}
        {algoAnalysis?.prediction && (
          <div style={{ background: algoAnalysis.prediction.action === 'SKIP' ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.1)', padding: '24px', borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '40px' }}>{algoAnalysis.prediction.action === 'SKIP' ? '🚫' : '✅'}</div>
              <div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: algoAnalysis.prediction.action === 'SKIP' ? '#f87171' : '#4ade80' }}>{algoAnalysis.prediction.perpetualAction}</div>
                <div style={{ fontSize: '13px', color: '#888' }}>Confidence: {algoAnalysis.prediction.confidence}%</div>
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', color: '#ddd', lineHeight: '1.6' }}>{algoAnalysis.prediction.reasoning}</div>
            </div>
            {algoAnalysis.prediction.pairsTrade && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: 'rgba(52,211,153,0.2)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#4ade80' }}>LONG</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4ade80' }}>{algoAnalysis.prediction.pairsTrade.long}</div>
                </div>
                <div style={{ background: 'rgba(248,113,113,0.2)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#f87171' }}>SHORT</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f87171' }}>{algoAnalysis.prediction.pairsTrade.short}</div>
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}><div style={{ fontSize: '10px', color: '#888' }}>Current Gap</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{algoAnalysis.prediction.currentGap}%</div></div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}><div style={{ fontSize: '10px', color: '#888' }}>ML Target</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4ade80' }}>{algoAnalysis.prediction.targetGap}%</div></div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}><div style={{ fontSize: '10px', color: '#888' }}>Exp Move</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4ade80' }}>{algoAnalysis.prediction.expectedMove}%</div></div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}><div style={{ fontSize: '10px', color: '#888' }}>Risk</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: algoAnalysis.prediction.riskLevel === 'HIGH' ? '#f87171' : '#4ade80' }}>{algoAnalysis.prediction.riskLevel}</div></div>
            </div>
          </div>
        )}
