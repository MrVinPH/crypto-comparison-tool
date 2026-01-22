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

  // ML Function 1: Optimal Reversion Factor
  const calcReversionFactor = (chartData) => {
    if (chartData.length < 20) return { factor: 0.6, confidence: 0, samples: 0 };
    const diffs = chartData.map(d => d.diff), samples = [], lb = 10;
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
            if (rev > -0.5 && rev < 1.5) samples.push({ rev, wt: Math.abs(dev) / std });
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

  // ML Function 2: Optimize Entry Threshold
  const optimizeThreshold = (chartData) => {
    if (chartData.length < 30) return { threshold: 1.2, bestWinRate: 0, bestProfitFactor: 0, bestTrades: 0 };
    const diffs = chartData.map(d => d.diff);
    let best = { threshold: 1.2, score: -Infinity, winRate: 0, pf: 0, trades: 0 };
    for (const th of [0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.5]) {
      let w = 0, l = 0, tp = 0, tl = 0;
      for (let i = 10; i < diffs.length - 1; i++) {
        const hist = diffs.slice(i - 10, i);
        const mean = hist.reduce((a, b) => a + b, 0) / 10;
        const std = Math.sqrt(hist.reduce((s, v) => s + (v - mean) ** 2, 0) / 10);
        const cur = diffs[i], nxt = diffs[i + 1];
        if (cur > mean + th * std) { const pnl = cur - nxt; pnl > 0 ? (w++, tp += pnl) : (l++, tl += Math.abs(pnl)); }
        else if (cur < mean - th * std) { const pnl = nxt - cur; pnl > 0 ? (w++, tp += pnl) : (l++, tl += Math.abs(pnl)); }
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

  // ML Function 3: Optimal Holding Period
  const calcHoldingPeriod = (chartData) => {
    if (chartData.length < 30) return { periods: 1, expectedReturn: 0, winRate: 0 };
    const diffs = chartData.map(d => d.diff), results = {};
    for (let p = 1; p <= 5; p++) results[p] = { returns: [], wins: 0, total: 0 };
    for (let i = 10; i < diffs.length - 5; i++) {
      const hist = diffs.slice(i - 10, i);
      const mean = hist.reduce((a, b) => a + b, 0) / 10;
      const std = Math.sqrt(hist.reduce((s, v) => s + (v - mean) ** 2, 0) / 10);
      if (Math.abs(diffs[i] - mean) > std) {
        const dir = diffs[i] > mean ? -1 : 1;
        for (let p = 1; p <= Math.min(5, diffs.length - i - 1); p++) {
          const pnl = dir * (diffs[i + p] - diffs[i]);
          results[p].returns.push(pnl);
          results[p].total++;
          if (pnl > 0) results[p].wins++;
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

  // ML Function 4: Market Regime Detection
  const detectRegime = (chartData) => {
    if (chartData.length < 20) return { regime: 'UNKNOWN', strength: 0, recommendation: 'Insufficient data', autocorrelation: 0, hurstEstimate: 0.5 };
    const diffs = chartData.map(d => d.diff), returns = [];
    for (let i = 1; i < diffs.length; i++) returns.push(diffs[i] - diffs[i - 1]);
    const meanRet = returns.reduce((a, b) => a + b, 0) / returns.length;
    let num = 0, den = 0;
    for (let i = 1; i < returns.length; i++) num += (returns[i] - meanRet) * (returns[i - 1] - meanRet);
    for (let i = 0; i < returns.length; i++) den += (returns[i] - meanRet) ** 2;
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
    return { regime, strength: strength.toFixed(1), autocorrelation: autocorr.toFixed(3), hurstEstimate: hurst.toFixed(3), recommendation: rec };
  };

  // ML Function 5: Calculate Dynamic Thresholds (KEY CHANGE - NO MORE HARDCODED VALUES)
  const calcMLThresholds = (backtestRes, mlMetrics, chartData) => {
    if (!backtestRes || !mlMetrics || chartData.length < 10) {
      return { minWinRate: 50, minProfitFactor: 1.0, minGap: 0.5, source: 'DEFAULT' };
    }
    const diffs = chartData.map(d => d.diff);
    const std = Math.sqrt(diffs.reduce((s, v) => s + (v - diffs.reduce((a, b) => a + b, 0) / diffs.length) ** 2, 0) / diffs.length);
    // Dynamic thresholds based on ML analysis
    const mlWinRate = parseFloat(mlMetrics.entryThreshold?.bestWinRate) || 50;
    const mlPF = parseFloat(mlMetrics.entryThreshold?.bestProfitFactor) || 1.0;
    // Set thresholds slightly below observed performance to allow trades
    const minWinRate = Math.max(45, mlWinRate - 10); // Allow 10% below best observed
    const minProfitFactor = Math.max(0.8, mlPF * 0.7); // Allow 30% below best observed
    const minGap = Math.max(0.3, std * 0.5); // Use half std dev as minimum gap
    return { minWinRate, minProfitFactor, minGap: parseFloat(minGap.toFixed(2)), source: 'ML_OPTIMIZED', observedWinRate: mlWinRate, observedPF: mlPF };
  };

  // Run ML Analysis
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

  const runBacktest = (chartData, ml = null) => {
    if (chartData.length < 20) return null;
    const th = ml?.entryThreshold?.threshold || 1.2;
    const diffs = chartData.map(d => d.diff);
    let trades = [], w = 0, l = 0, tp = 0;
    for (let i = 10; i < chartData.length - 1; i++) {
      const hist = diffs.slice(i - 10, i);
      const mean = hist.reduce((a, b) => a + b, 0) / 10;
      const std = Math.sqrt(hist.reduce((s, v) => s + (v - mean) ** 2, 0) / 10);
      const cur = diffs[i], nxt = diffs[i + 1];
      let pnl = null, sig = null;
      if (cur > mean + th * std) { pnl = cur - nxt; sig = 'SHORT_GAP'; }
      else if (cur < mean - th * std) { pnl = nxt - cur; sig = 'LONG_GAP'; }
      if (pnl !== null) {
        tp += pnl; pnl > 0 ? w++ : l++;
        trades.push({ entry: i, signal: sig, entryDiff: cur, exitDiff: nxt, profitLoss: pnl, win: pnl > 0 });
      }
    }
    const wr = trades.length > 0 ? (w / trades.length) * 100 : 0;
    const avgW = w > 0 ? trades.filter(t => t.win).reduce((s, t) => s + t.profitLoss, 0) / w : 0;
    const avgL = l > 0 ? Math.abs(trades.filter(t => !t.win).reduce((s, t) => s + t.profitLoss, 0) / l) : 0;
    const pf = avgL > 0 ? (avgW * w) / (avgL * l) : w > 0 ? 999 : 0;
    return { totalTrades: trades.length, wins: w, losses: l, winRate: wr.toFixed(1), totalProfit: tp.toFixed(2), avgWin: avgW.toFixed(2), avgLoss: avgL.toFixed(2), profitFactor: pf.toFixed(2), entryThresholdUsed: th };
  };

  const generatePrediction = (chartData, backtestRes, a1Info, a2Info, ml) => {
    if (!chartData.length || !backtestRes || !priceInfo.asset1 || !priceInfo.asset2) return null;
    const lastDiff = priceInfo.asset2.changeTimeframe - priceInfo.asset1.changeTimeframe;
    const diffs = chartData.map(d => d.diff);
    const mean = diffs.reduce((s, v) => s + v, 0) / diffs.length;
    const std = Math.sqrt(diffs.reduce((s, v) => s + (v - mean) ** 2, 0) / diffs.length);
    const mlRev = ml?.reversionFactor?.factor || 0.6;
    const mlTh = ml?.entryThreshold?.threshold || 1.2;
    const mlHP = ml?.holdingPeriod?.periods || 1;
    const regime = ml?.marketRegime?.regime || 'UNKNOWN';
    // *** KEY CHANGE: Use ML-calculated dynamic thresholds ***
    const dynTh = calcMLThresholds(backtestRes, ml, chartData);
    const wr = parseFloat(backtestRes.winRate);
    const pf = parseFloat(backtestRes.profitFactor);
    const avgW = parseFloat(backtestRes.avgWin), avgL = parseFloat(backtestRes.avgLoss);
    const ev = (wr / 100 * avgW) - ((1 - wr / 100) * avgL) - 0.15;
    const meetsWR = wr >= dynTh.minWinRate;
    const meetsPF = pf >= dynTh.minProfitFactor;
    const meetsGap = Math.abs(lastDiff) >= dynTh.minGap;
    const mlRecommends = regime === 'MEAN_REVERTING' || regime === 'NEUTRAL';
    // More permissive: require ML recommendation AND at least one threshold OR positive expected value
    const shouldTrade = mlRecommends && (meetsWR || meetsPF || meetsGap || ev > 0);
    let result = { autoThresholds: { ...dynTh, expectedValue: ev.toFixed(3), meetsWinRate: meetsWR, meetsProfitFactor: meetsPF, meetsGap: meetsGap, actualWinRate: wr, actualPF: pf, actualGap: Math.abs(lastDiff).toFixed(2) } };
    if (!shouldTrade) {
      let reasons = [];
      if (!mlRecommends) reasons.push(`Market regime ${regime} unfavorable`);
      if (!meetsWR) reasons.push(`WR ${wr}% < ${dynTh.minWinRate.toFixed(0)}%`);
      if (!meetsPF) reasons.push(`PF ${pf} < ${dynTh.minProfitFactor.toFixed(1)}`);
      if (!meetsGap) reasons.push(`Gap ${Math.abs(lastDiff).toFixed(2)}% < ${dynTh.minGap}%`);
      if (ev <= 0) reasons.push(`EV ${ev.toFixed(3)} negative`);
      return { ...result, action: 'SKIP', perpetualAction: 'NO TRADE', confidence: 0, reasoning: reasons.join(', '), pairsTrade: null };
    }
    const expMove = lastDiff > mean ? -(Math.abs(lastDiff - mean) * mlRev) : Math.abs(lastDiff - mean) * mlRev;
    const targetGap = lastDiff + expMove;
    const conf = Math.min(60 + (meetsWR ? 15 : 0) + (meetsPF ? 15 : 0) + (meetsGap ? 10 : 0) + (ev > 0 ? 10 : 0), 100);
    const long = lastDiff > 0 ? a1Info.symbol : a2Info.symbol;
    const short = lastDiff > 0 ? a2Info.symbol : a1Info.symbol;
    return {
      ...result, action: 'PAIRS', perpetualAction: 'PAIRS TRADE', confidence: conf.toFixed(1),
      reasoning: `ML: ${short} ahead by ${Math.abs(lastDiff).toFixed(2)}%. ${(mlRev * 100).toFixed(0)}% reversion expected. Regime: ${regime}. Entry: ${mlTh}σ. Hold: ${mlHP} bar(s). EV: ${ev.toFixed(3)}`,
      pairsTrade: { long, short, currentGap: lastDiff.toFixed(2), targetGap: targetGap.toFixed(2), expectedProfit: Math.abs(expMove).toFixed(2), mlReversionFactor: (mlRev * 100).toFixed(0) },
      currentGap: lastDiff.toFixed(2), targetGap: targetGap.toFixed(2), expectedMove: expMove.toFixed(2),
      riskLevel: std > 2 ? 'HIGH' : std > 1 ? 'MEDIUM' : 'LOW', volatility: std.toFixed(2),
      mlReversionFactor: (mlRev * 100).toFixed(0), mlEntryThreshold: mlTh, mlHoldingPeriod: mlHP, marketRegime: regime
    };
  };

  const loadData = async () => {
    setLoading(true);
    const a1Info = getAssetInfo(asset1), a2Info = getAssetInfo(asset2);
    try {
      const { interval: fi, limit } = getTimeframeDetails(timeframe, interval);
      const [r1, r2] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/klines?symbol=${asset1}&interval=${fi}&limit=${limit}`),
        fetch(`https://api.binance.com/api/v3/klines?symbol=${asset2}&interval=${fi}&limit=${limit}`)
      ]);
      const d1 = await r1.json(), d2 = await r2.json();
      if (!d1.length || !d2.length) throw new Error('No data');
      const [r1_24, r2_24] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/klines?symbol=${asset1}&interval=1d&limit=2`),
        fetch(`https://api.binance.com/api/v3/klines?symbol=${asset2}&interval=1d&limit=2`)
      ]);
      const d1_24 = await r1_24.json(), d2_24 = await r2_24.json();
      const sp1 = parseFloat(d1[0][4]), sp2 = parseFloat(d2[0][4]);
      const cp1 = parseFloat(d1[d1.length - 1][4]), cp2 = parseFloat(d2[d2.length - 1][4]);
      const pp1 = d1_24.length >= 2 ? parseFloat(d1_24[d1_24.length - 2][4]) : sp1;
      const pp2 = d2_24.length >= 2 ? parseFloat(d2_24[d2_24.length - 2][4]) : sp2;
      setPriceInfo({
        asset1: { current: cp1, previous: pp1, startPrice: sp1, change: ((cp1 - pp1) / pp1) * 100, changeTimeframe: ((cp1 - sp1) / sp1) * 100 },
        asset2: { current: cp2, previous: pp2, startPrice: sp2, change: ((cp2 - pp2) / pp2) * 100, changeTimeframe: ((cp2 - sp2) / sp2) * 100 }
      });
      const chartData = [], minLen = Math.min(d1.length, d2.length);
      const dateFormat = limit > 90 ? { month: 'short', day: 'numeric' } : fi.includes('m') || fi.includes('h') ? { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' } : { month: 'short', day: 'numeric' };
      for (let i = 0; i < minLen; i++) {
        const c1 = parseFloat(d1[i][4]), c2 = parseFloat(d2[i][4]);
        const ch1 = ((c1 - sp1) / sp1) * 100, ch2 = ((c2 - sp2) / sp2) * 100;
        chartData.push({ date: new Date(d1[i][0]).toLocaleDateString('en-US', dateFormat), asset1Daily: parseFloat(ch1.toFixed(2)), asset2Daily: parseFloat(ch2.toFixed(2)), diff: parseFloat((ch2 - ch1).toFixed(2)) });
      }
      setData(chartData);
      const ml = runMLAnalysis(chartData);
      setMlMetrics(ml);
      const bt = runBacktest(chartData, ml);
      setBacktestResults(bt);
      const pred = generatePrediction(chartData, bt, a1Info, a2Info, ml);
      setAlgoAnalysis({ prediction: pred });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [timeframe, interval, asset1, asset2]);

  useEffect(() => {
    if (data.length > 0 && backtestResults && priceInfo.asset1 && priceInfo.asset2) {
      const ml = runMLAnalysis(data);
      setMlMetrics(ml);
      const pred = generatePrediction(data, backtestResults, getAssetInfo(asset1), getAssetInfo(asset2), ml);
      setAlgoAnalysis({ prediction: pred });
    }
  }, [priceInfo]);

  const a1Info = getAssetInfo(asset1), a2Info = getAssetInfo(asset2);
  const avgDiff = data.length > 0 ? (data.reduce((s, d) => s + d.diff, 0) / data.length).toFixed(2) : 0;
  const CustomTooltip = ({ active, payload }) => active && payload?.length ? (
    <div style={{ backgroundColor: 'white', padding: '12px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>{payload[0].payload.date}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: a1Info.color }} /><span>{a1Info.symbol}: {payload[0].value}%</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: a2Info.color }} /><span>{a2Info.symbol}: {payload[1].value}%</span></div>
    </div>
  ) : null;

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'linear-gradient(to bottom right, #1f2937, #111827)', padding: '16px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ backgroundColor: '#1f2937', borderRadius: '12px 12px 0 0', border: '1px solid #374151', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', margin: 0 }}>ML-Powered Crypto Analysis</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '13px', color: '#9ca3af' }}>Dynamic Thresholds</span>
              <span style={{ padding: '2px 8px', backgroundColor: '#8b5cf6', color: '#e9d5ff', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px' }}><Brain size={10} style={{ display: 'inline', marginRight: '4px' }} />ML ACTIVE</span>
            </div>
          </div>
          <button onClick={loadData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: loading ? '#4b5563' : '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer' }}><RefreshCw size={14} />Refresh</button>
        </div>

        {/* ML Metrics */}
        {mlMetrics && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '20px' }}>
            <div style={{ borderRadius: '10px', padding: '16px', background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(109,40,217,0.3))', border: '2px solid rgba(139,92,246,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <Brain size={24} color="#a78bfa" />
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', margin: 0 }}>Machine Learning Analysis</h3>
                  <p style={{ fontSize: '12px', color: '#c4b5fd', margin: 0 }}>{mlMetrics.reversionFactor?.samples || 0} samples analyzed</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: parseFloat(mlMetrics.overallConfidence) >= 50 ? '#34d399' : '#fbbf24' }}>{mlMetrics.overallConfidence}%</div>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>ML Confidence</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>🎯 Reversion</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#a78bfa' }}>{(mlMetrics.reversionFactor?.factor * 100).toFixed(0)}%</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>📊 Entry</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#60a5fa' }}>{mlMetrics.entryThreshold?.threshold}σ</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>⏱️ Hold</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#34d399' }}>{mlMetrics.holdingPeriod?.periods} bar(s)</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>📈 Regime</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: mlMetrics.marketRegime?.regime === 'MEAN_REVERTING' ? '#34d399' : mlMetrics.marketRegime?.regime === 'TRENDING' ? '#f87171' : '#fbbf24' }}>{mlMetrics.marketRegime?.regime?.replace('_', ' ')}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Thresholds Display */}
        {algoAnalysis?.prediction?.autoThresholds && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '20px' }}>
            <div style={{ borderRadius: '10px', padding: '16px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#60a5fa', margin: '0 0 12px 0' }}>🤖 ML-Optimized Thresholds (Dynamic)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', fontSize: '12px' }}>
                <div style={{ padding: '8px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                  <div style={{ color: '#9ca3af' }}>Min Win Rate</div>
                  <div style={{ color: algoAnalysis.prediction.autoThresholds.meetsWinRate ? '#34d399' : '#f87171', fontWeight: 'bold' }}>
                    {algoAnalysis.prediction.autoThresholds.actualWinRate}% / {algoAnalysis.prediction.autoThresholds.minWinRate.toFixed(0)}%
                    {algoAnalysis.prediction.autoThresholds.meetsWinRate ? ' ✓' : ' ✗'}
                  </div>
                </div>
                <div style={{ padding: '8px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                  <div style={{ color: '#9ca3af' }}>Min Profit Factor</div>
                  <div style={{ color: algoAnalysis.prediction.autoThresholds.meetsProfitFactor ? '#34d399' : '#f87171', fontWeight: 'bold' }}>
                    {algoAnalysis.prediction.autoThresholds.actualPF} / {algoAnalysis.prediction.autoThresholds.minProfitFactor.toFixed(1)}
                    {algoAnalysis.prediction.autoThresholds.meetsProfitFactor ? ' ✓' : ' ✗'}
                  </div>
                </div>
                <div style={{ padding: '8px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                  <div style={{ color: '#9ca3af' }}>Min Gap</div>
                  <div style={{ color: algoAnalysis.prediction.autoThresholds.meetsGap ? '#34d399' : '#f87171', fontWeight: 'bold' }}>
                    {algoAnalysis.prediction.autoThresholds.actualGap}% / {algoAnalysis.prediction.autoThresholds.minGap}%
                    {algoAnalysis.prediction.autoThresholds.meetsGap ? ' ✓' : ' ✗'}
                  </div>
                </div>
                <div style={{ padding: '8px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                  <div style={{ color: '#9ca3af' }}>Expected Value</div>
                  <div style={{ color: parseFloat(algoAnalysis.prediction.autoThresholds.expectedValue) > 0 ? '#34d399' : '#f87171', fontWeight: 'bold' }}>
                    {algoAnalysis.prediction.autoThresholds.expectedValue}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trade Signal or No Trade */}
        {algoAnalysis?.prediction && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '20px' }}>
            {algoAnalysis.prediction.action !== 'SKIP' ? (
              <div style={{ borderRadius: '10px', padding: '20px', background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,78,59,0.3))', border: '2px solid rgba(16,185,129,0.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <Brain size={32} color="#34d399" />
                  <div>
                    <div style={{ fontSize: '26px', fontWeight: 'bold', color: 'white' }}>{algoAnalysis.prediction.perpetualAction}</div>
                    <div style={{ fontSize: '12px', color: '#d1d5db' }}>Confidence: {algoAnalysis.prediction.confidence}% | Reversion: {algoAnalysis.prediction.mlReversionFactor}%</div>
                  </div>
                </div>
                <div style={{ padding: '12px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '6px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>🤖 ML ANALYSIS</div>
                  <p style={{ color: '#e5e7eb', fontSize: '13px', margin: 0 }}>{algoAnalysis.prediction.reasoning}</p>
                </div>
                {algoAnalysis.prediction.pairsTrade && (
                  <div style={{ padding: '14px', backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: '6px', border: '2px solid rgba(34,197,94,0.4)', marginBottom: '14px' }}>
                    <div style={{ fontSize: '12px', color: '#6ee7b7', fontWeight: 'bold', marginBottom: '10px' }}>📊 EXECUTE BOTH POSITIONS</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={{ padding: '10px', backgroundColor: 'rgba(16,185,129,0.2)', borderRadius: '4px' }}>
                        <div style={{ fontSize: '11px', color: '#6ee7b7' }}>LONG</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#34d399' }}>{algoAnalysis.prediction.pairsTrade.long}</div>
                      </div>
                      <div style={{ padding: '10px', backgroundColor: 'rgba(239,68,68,0.2)', borderRadius: '4px' }}>
                        <div style={{ fontSize: '11px', color: '#fca5a5' }}>SHORT</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f87171' }}>{algoAnalysis.prediction.pairsTrade.short}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: '10px', padding: '8px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '4px', fontSize: '12px' }}>
                      <div style={{ color: '#d1d5db' }}>Expected: <span style={{ color: '#34d399', fontWeight: 'bold' }}>+{algoAnalysis.prediction.pairsTrade.expectedProfit}%</span></div>
                      <div style={{ color: '#9ca3af' }}>Gap: {algoAnalysis.prediction.pairsTrade.currentGap}% → {algoAnalysis.prediction.pairsTrade.targetGap}%</div>
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}><div style={{ fontSize: '11px', color: '#9ca3af' }}>Current Gap</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{algoAnalysis.prediction.currentGap}%</div></div>
                  <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}><div style={{ fontSize: '11px', color: '#9ca3af' }}>ML Target</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: '#34d399' }}>{algoAnalysis.prediction.targetGap}%</div></div>
                  <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}><div style={{ fontSize: '11px', color: '#9ca3af' }}>Exp Move</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: '#34d399' }}>{algoAnalysis.prediction.expectedMove}%</div></div>
                  <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}><div style={{ fontSize: '11px', color: '#9ca3af' }}>Risk</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: algoAnalysis.prediction.riskLevel === 'HIGH' ? '#f87171' : '#34d399' }}>{algoAnalysis.prediction.riskLevel}</div></div>
                </div>
              </div>
            ) : (
              <div style={{ borderRadius: '10px', padding: '20px', background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(127,29,29,0.2))', border: '2px solid rgba(239,68,68,0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '32px' }}>🚫</div>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f87171' }}>NO TRADE SIGNAL</div>
                    <div style={{ fontSize: '12px', color: '#fca5a5' }}>ML thresholds not met</div>
                  </div>
                </div>
                <div style={{ padding: '12px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '13px', color: '#e5e7eb' }}>{algoAnalysis.prediction.reasoning}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Backtest Results */}
        {backtestResults && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '20px' }}>
            <div style={{ borderRadius: '10px', padding: '16px', backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <CheckCircle size={20} color="#60a5fa" />
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'white', margin: 0 }}>Backtest (Threshold: {backtestResults.entryThresholdUsed}σ)</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}><div style={{ fontSize: '11px', color: '#9ca3af' }}>Win Rate</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: parseFloat(backtestResults.winRate) >= 50 ? '#34d399' : '#f87171' }}>{backtestResults.winRate}%</div></div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}><div style={{ fontSize: '11px', color: '#9ca3af' }}>Trades</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{backtestResults.totalTrades}</div></div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}><div style={{ fontSize: '11px', color: '#9ca3af' }}>Profit Factor</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: parseFloat(backtestResults.profitFactor) >= 1 ? '#34d399' : '#fbbf24' }}>{backtestResults.profitFactor}</div></div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}><div style={{ fontSize: '11px', color: '#9ca3af' }}>Avg Win</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: '#34d399' }}>+{backtestResults.avgWin}%</div></div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}><div style={{ fontSize: '11px', color: '#9ca3af' }}>Avg Loss</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f87171' }}>-{backtestResults.avgLoss}%</div></div>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Asset 1</label>
              <select value={asset1} onChange={(e) => setAsset1(e.target.value)} style={{ width: '100%', padding: '8px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '6px' }}>
                {CRYPTO_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.symbol} - {c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Asset 2</label>
              <select value={asset2} onChange={(e) => setAsset2(e.target.value)} style={{ width: '100%', padding: '8px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '6px' }}>
                {CRYPTO_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.symbol} - {c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Interval</label>
              <select value={interval} onChange={(e) => setInterval(e.target.value)} style={{ width: '100%', padding: '8px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '6px' }}>
                {INTERVAL_OPTIONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Timeframe buttons */}
        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '10px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ color: '#9ca3af', fontSize: '13px', marginRight: '6px' }}>Timeframe:</span>
            {['1D', '7D', '1M', '3M', '6M', '1Y', 'YTD'].map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: timeframe === tf ? '#2563eb' : '#374151', color: timeframe === tf ? 'white' : '#d1d5db', fontWeight: '500', fontSize: '13px' }}>{tf}</button>
            ))}
          </div>
        </div>

        {/* Charts */}
        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '20px' }}>
          <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 'bold', marginBottom: '14px' }}>Asset Performance</h2>
          {loading ? <div style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading...</div> : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-45} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="asset1Daily" stroke={a1Info.color} strokeWidth={2} name={a1Info.name} dot={false} />
                <Line type="monotone" dataKey="asset2Daily" stroke={a2Info.color} strokeWidth={2} name={a2Info.name} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', borderBottom: '1px solid #374151', borderRadius: '0 0 12px 12px', padding: '20px' }}>
          <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 'bold', marginBottom: '14px' }}>Gap Analysis (Mean: {avgDiff}%)</h2>
          {loading ? <div style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading...</div> : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-45} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="diff" stroke="#10b981" strokeWidth={2} name={`Gap (${a2Info.symbol} - ${a1Info.symbol})`} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
