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
  { id: 'DOGEUSDT', symbol: 'DOGE', name: 'Dogecoin', color: '#c2a633' },
  { id: 'LINKUSDT', symbol: 'LINK', name: 'Chainlink', color: '#2a5ada' },
];

const INTERVALS = [
  { value: '15m', label: '15m' }, { value: '1h', label: '1H' }, { value: '4h', label: '4H' },
  { value: '1d', label: '1D' }, { value: '1w', label: '1W' },
];

export default function App() {
  const [data, setData] = useState([]);
  const [timeframe, setTimeframe] = useState('7D');
  const [interval, setInterval] = useState('1d');
  const [asset1, setAsset1] = useState('BTCUSDT');
  const [asset2, setAsset2] = useState('ETHUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [priceInfo, setPriceInfo] = useState({ asset1: null, asset2: null });
  const [algoAnalysis, setAlgoAnalysis] = useState(null);
  const [backtestResults, setBacktestResults] = useState(null);
  const [trendAnalysis, setTrendAnalysis] = useState({ asset1: null, asset2: null });
  const [thresholds, setThresholds] = useState({ minWinRate: 65, minProfitFactor: 1.5, minGap: 1.0 });

  const getAssetInfo = (id) => CRYPTO_OPTIONS.find(a => a.id === id) || CRYPTO_OPTIONS[0];
  const asset1Info = getAssetInfo(asset1);
  const asset2Info = getAssetInfo(asset2);

  const getLimit = (tf, int) => {
    const limits = { '1D': 24, '7D': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
    return limits[tf] || 7;
  };

  const analyzeTrend = (priceData, symbol) => {
    if (!priceData || priceData.length < 5) return null;
    const closes = priceData.map(d => parseFloat(d[4]));
    const n = closes.length;
    const sma5 = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const sma10 = n >= 10 ? closes.slice(-10).reduce((a, b) => a + b, 0) / 10 : sma5;
    const sma20 = n >= 20 ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20 : sma10;
    const current = closes[n - 1];
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const lb = Math.min(n, 14);
    for (let i = 0; i < lb; i++) {
      sumX += i; sumY += closes[n - lb + i]; sumXY += i * closes[n - lb + i]; sumX2 += i * i;
    }
    const slope = (lb * sumXY - sumX * sumY) / (lb * sumX2 - sumX * sumX);
    const slopePct = (slope / current) * 100;
    
    let gains = 0, losses = 0;
    const rsiP = Math.min(14, n - 1);
    for (let i = n - rsiP; i < n; i++) {
      const chg = closes[i] - closes[i - 1];
      if (chg > 0) gains += chg; else losses -= chg;
    }
    const rs = losses === 0 ? 100 : (gains / rsiP) / (losses / rsiP);
    const rsi = 100 - (100 / (1 + rs));
    
    const rocP = Math.min(10, n - 1);
    const roc = ((current - closes[n - 1 - rocP]) / closes[n - 1 - rocP]) * 100;
    
    let bull = 0, bear = 0;
    if (current > sma5) bull++; else bear++;
    if (current > sma10) bull++; else bear++;
    if (current > sma20) bull += 2; else bear += 2;
    if (sma5 > sma10) bull++; else bear++;
    if (sma10 > sma20) bull++; else bear++;
    if (slope > 0) bull += 2; else bear += 2;
    if (rsi > 50) bull++; else bear++;
    if (roc > 0) bull++; else bear++;
    
    const bullPct = (bull / (bull + bear)) * 100;
    let trend = 'NEUTRAL', strength = 50;
    if (bullPct >= 70) { trend = 'STRONG_UPTREND'; strength = (bullPct - 50) * 2; }
    else if (bullPct >= 55) { trend = 'UPTREND'; strength = (bullPct - 50) * 2; }
    else if (bullPct <= 30) { trend = 'STRONG_DOWNTREND'; strength = (50 - bullPct) * 2; }
    else if (bullPct <= 45) { trend = 'DOWNTREND'; strength = (50 - bullPct) * 2; }
    
    const signals = [];
    if (rsi > 70) signals.push('Overbought');
    else if (rsi < 30) signals.push('Oversold');
    if (current > sma20 && sma5 > sma10) signals.push('Bullish MA');
    if (current < sma20 && sma5 < sma10) signals.push('Bearish MA');
    
    return { symbol, trend, strength: Math.min(strength, 100).toFixed(0), bullPct: bullPct.toFixed(0), rsi: rsi.toFixed(0), roc: roc.toFixed(2), slopePct: slopePct.toFixed(3), signals };
  };

  const runBacktest = (chartData) => {
    if (chartData.length < 20) return null;
    let wins = 0, losses = 0, totalProfit = 0;
    const lb = 10;
    for (let i = lb; i < chartData.length - 1; i++) {
      const hist = chartData.slice(i - lb, i);
      const curr = chartData[i].diff, next = chartData[i + 1].diff;
      const diffs = hist.map(d => d.diff);
      const mean = diffs.reduce((s, v) => s + v, 0) / diffs.length;
      const std = Math.sqrt(diffs.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / diffs.length);
      if (curr > mean + 1.2 * std) {
        const pl = curr - next; totalProfit += pl;
        if (pl > 0) wins++; else losses++;
      } else if (curr < mean - 1.2 * std) {
        const pl = next - curr; totalProfit += pl;
        if (pl > 0) wins++; else losses++;
      }
    }
    const total = wins + losses;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const avgWin = wins > 0 ? totalProfit / wins : 0;
    const avgLoss = losses > 0 ? Math.abs(totalProfit) / losses : 0;
    const pf = avgLoss > 0 ? (avgWin * wins) / (avgLoss * losses) : wins > 0 ? 999 : 0;
    return { total, wins, losses, winRate: winRate.toFixed(1), avgWin: avgWin.toFixed(2), avgLoss: avgLoss.toFixed(2), pf: pf.toFixed(2) };
  };

  const generatePrediction = (chartData, backtest, trends) => {
    if (!chartData.length || !backtest || !priceInfo.asset1 || !priceInfo.asset2) return null;
    const lastDiff = priceInfo.asset2.changeTimeframe - priceInfo.asset1.changeTimeframe;
    const diffs = chartData.map(d => d.diff);
    const mean = diffs.reduce((s, v) => s + v, 0) / diffs.length;
    const std = Math.sqrt(diffs.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / diffs.length);
    
    const meetsWR = parseFloat(backtest.winRate) >= thresholds.minWinRate;
    const meetsPF = parseFloat(backtest.pf) >= thresholds.minProfitFactor;
    const meetsGap = Math.abs(lastDiff) >= thresholds.minGap;
    
    let trendBonus = 0, trendAlign = 'NEUTRAL', trendWarn = null;
    const t1 = trends.asset1, t2 = trends.asset2;
    if (t1 && t2) {
      const t1Up = t1.trend.includes('UPTREND'), t1Down = t1.trend.includes('DOWNTREND');
      const t2Up = t2.trend.includes('UPTREND'), t2Down = t2.trend.includes('DOWNTREND');
      if (lastDiff > 0) {
        if (t1Up && t2Down) { trendAlign = 'ALIGNED'; trendBonus = 15; }
        else if (t1Up || t2Down) { trendAlign = 'PARTIAL'; trendBonus = 8; }
        else if (t1Down && t2Up) { trendAlign = 'COUNTER'; trendBonus = -10; trendWarn = `Counter-trend: LONG ${asset1Info.symbol} (${t1.trend}) + SHORT ${asset2Info.symbol} (${t2.trend})`; }
      } else {
        if (t2Up && t1Down) { trendAlign = 'ALIGNED'; trendBonus = 15; }
        else if (t2Up || t1Down) { trendAlign = 'PARTIAL'; trendBonus = 8; }
        else if (t2Down && t1Up) { trendAlign = 'COUNTER'; trendBonus = -10; trendWarn = `Counter-trend: LONG ${asset2Info.symbol} (${t2.trend}) + SHORT ${asset1Info.symbol} (${t1.trend})`; }
      }
    }
    
    if (!(meetsWR || meetsPF || meetsGap)) {
      return { action: 'SKIP', confidence: 0, reason: 'No thresholds met', trendAlign, trendWarn };
    }
    
    const longAsset = lastDiff > 0 ? asset1Info.symbol : asset2Info.symbol;
    const shortAsset = lastDiff > 0 ? asset2Info.symbol : asset1Info.symbol;
    const conf = Math.min(Math.max(60 + (meetsWR ? 15 : 0) + (meetsPF ? 15 : 0) + (meetsGap ? 10 : 0) + trendBonus, 0), 100);
    const expProfit = (Math.abs(lastDiff - mean) * 0.6).toFixed(2);
    
    return {
      action: 'PAIRS', longAsset, shortAsset, confidence: conf.toFixed(0),
      currentGap: lastDiff.toFixed(2), targetGap: mean.toFixed(2), expProfit,
      stopLoss: (std * 1.5).toFixed(2), trendAlign, trendBonus, trendWarn,
      riskLevel: std > 2 ? 'HIGH' : std > 1 ? 'MEDIUM' : 'LOW'
    };
  };

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const limit = getLimit(timeframe, interval);
      const [r1, r2] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/klines?symbol=${asset1}&interval=${interval}&limit=${limit}`),
        fetch(`https://api.binance.com/api/v3/klines?symbol=${asset2}&interval=${interval}&limit=${limit}`)
      ]);
      const d1 = await r1.json(), d2 = await r2.json();
      if (!d1.length || !d2.length) throw new Error('No data');
      
      const trend1 = analyzeTrend(d1, asset1Info.symbol);
      const trend2 = analyzeTrend(d2, asset2Info.symbol);
      setTrendAnalysis({ asset1: trend1, asset2: trend2 });
      
      const start1 = parseFloat(d1[0][4]), start2 = parseFloat(d2[0][4]);
      const curr1 = parseFloat(d1[d1.length-1][4]), curr2 = parseFloat(d2[d2.length-1][4]);
      const chg1 = ((curr1 - start1) / start1) * 100, chg2 = ((curr2 - start2) / start2) * 100;
      setPriceInfo({ asset1: { current: curr1, changeTimeframe: chg1 }, asset2: { current: curr2, changeTimeframe: chg2 } });
      
      const chartData = [];
      const minLen = Math.min(d1.length, d2.length);
      for (let i = 0; i < minLen; i++) {
        const c1 = parseFloat(d1[i][4]), c2 = parseFloat(d2[i][4]);
        const ch1 = ((c1 - start1) / start1) * 100, ch2 = ((c2 - start2) / start2) * 100;
        chartData.push({
          date: new Date(d1[i][0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          asset1Daily: parseFloat(ch1.toFixed(2)), asset2Daily: parseFloat(ch2.toFixed(2)), diff: parseFloat((ch2 - ch1).toFixed(2))
        });
      }
      setData(chartData);
      
      const bt = runBacktest(chartData);
      setBacktestResults(bt);
      const pred = generatePrediction(chartData, bt, { asset1: trend1, asset2: trend2 });
      setAlgoAnalysis({ prediction: pred });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, interval, asset1, asset2]);
  useEffect(() => {
    if (data.length && backtestResults && priceInfo.asset1) {
      const pred = generatePrediction(data, backtestResults, trendAnalysis);
      setAlgoAnalysis({ prediction: pred });
    } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thresholds]);

  const getTrendColor = (t) => t?.includes('STRONG_UP') ? '#22c55e' : t?.includes('UP') ? '#4ade80' : t?.includes('STRONG_DOWN') ? '#ef4444' : t?.includes('DOWN') ? '#f87171' : '#9ca3af';
  const avgDiff = data.length ? (data.reduce((s, d) => s + d.diff, 0) / data.length).toFixed(2) : 0;

  const Box = ({ children, style }) => <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', ...style }}>{children}</div>;

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'linear-gradient(135deg, #1f2937, #111827)', padding: '16px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ backgroundColor: '#1f2937', borderRadius: '12px 12px 0 0', border: '1px solid #374151', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', margin: 0 }}>AI Crypto Analyzer</h1>
            <p style={{ color: '#9ca3af', fontSize: '13px', margin: '4px 0 0' }}>Pairs Trading with Trend Analysis</p>
          </div>
          <button onClick={loadData} disabled={loading} style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {/* Trend Analysis */}
        {(trendAnalysis.asset1 || trendAnalysis.asset2) && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '20px' }}>
            <h3 style={{ color: 'white', fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={20} color="#60a5fa" /> Trend Analysis</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {[{ t: trendAnalysis.asset1, info: asset1Info }, { t: trendAnalysis.asset2, info: asset2Info }].map(({ t, info }, i) => t && (
                <div key={i} style={{ background: `linear-gradient(135deg, ${getTrendColor(t.trend)}20, ${getTrendColor(t.trend)}05)`, border: `1px solid ${getTrendColor(t.trend)}50`, borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>{info.symbol}</span>
                    <span style={{ color: getTrendColor(t.trend), fontWeight: 'bold' }}>{t.trend.replace(/_/g, ' ')}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <Box><div style={{ color: '#9ca3af', fontSize: '11px' }}>Strength</div><div style={{ color: getTrendColor(t.trend), fontWeight: 'bold', fontSize: '18px' }}>{t.strength}%</div></Box>
                    <Box><div style={{ color: '#9ca3af', fontSize: '11px' }}>RSI</div><div style={{ color: t.rsi > 70 ? '#f87171' : t.rsi < 30 ? '#34d399' : 'white', fontWeight: 'bold', fontSize: '18px' }}>{t.rsi}</div></Box>
                    <Box><div style={{ color: '#9ca3af', fontSize: '11px' }}>Momentum</div><div style={{ color: t.roc >= 0 ? '#34d399' : '#f87171', fontWeight: 'bold', fontSize: '18px' }}>{t.roc >= 0 ? '+' : ''}{t.roc}%</div></Box>
                    <Box><div style={{ color: '#9ca3af', fontSize: '11px' }}>Bull Score</div><div style={{ color: t.bullPct >= 55 ? '#34d399' : t.bullPct <= 45 ? '#f87171' : '#fbbf24', fontWeight: 'bold', fontSize: '18px' }}>{t.bullPct}%</div></Box>
                  </div>
                  {t.signals.length > 0 && <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{t.signals.map((s, j) => <span key={j} style={{ padding: '3px 8px', backgroundColor: s.includes('Over') ? 'rgba(239,68,68,0.2)' : s.includes('Bull') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', color: s.includes('Over') || s.includes('Bear') ? '#fca5a5' : '#86efac', fontSize: '11px', borderRadius: '4px' }}>{s}</span>)}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trade Signal */}
        {algoAnalysis?.prediction && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '20px' }}>
            {algoAnalysis.prediction.action === 'PAIRS' ? (
              <div style={{ borderRadius: '10px', padding: '20px', background: algoAnalysis.prediction.trendAlign === 'ALIGNED' ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))' : algoAnalysis.prediction.trendAlign === 'COUNTER' ? 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))' : 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))', border: `1px solid ${algoAnalysis.prediction.trendAlign === 'ALIGNED' ? 'rgba(34,197,94,0.4)' : algoAnalysis.prediction.trendAlign === 'COUNTER' ? 'rgba(239,68,68,0.4)' : 'rgba(59,130,246,0.4)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <Brain size={32} color="#60a5fa" />
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>PAIRS TRADE</div>
                    <div style={{ color: '#9ca3af', fontSize: '14px' }}>Confidence: {algoAnalysis.prediction.confidence}%</div>
                  </div>
                </div>
                
                {/* Trend Alignment */}
                <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: algoAnalysis.prediction.trendAlign === 'ALIGNED' ? 'rgba(34,197,94,0.2)' : algoAnalysis.prediction.trendAlign === 'COUNTER' ? 'rgba(239,68,68,0.2)' : 'rgba(251,191,36,0.2)', borderRadius: '8px' }}>
                  <div style={{ color: algoAnalysis.prediction.trendAlign === 'ALIGNED' ? '#86efac' : algoAnalysis.prediction.trendAlign === 'COUNTER' ? '#fca5a5' : '#fcd34d', fontWeight: 'bold', fontSize: '13px' }}>
                    {algoAnalysis.prediction.trendAlign === 'ALIGNED' ? '✅ TREND ALIGNED' : algoAnalysis.prediction.trendAlign === 'PARTIAL' ? '⚠️ PARTIAL ALIGNMENT' : algoAnalysis.prediction.trendAlign === 'COUNTER' ? '🚨 COUNTER-TREND' : '📊 NEUTRAL'}
                    {algoAnalysis.prediction.trendBonus !== 0 && <span style={{ marginLeft: '8px' }}>({algoAnalysis.prediction.trendBonus > 0 ? '+' : ''}{algoAnalysis.prediction.trendBonus}% conf)</span>}
                  </div>
                  {algoAnalysis.prediction.trendWarn && <div style={{ color: '#fca5a5', fontSize: '12px', marginTop: '6px' }}>{algoAnalysis.prediction.trendWarn}</div>}
                </div>

                {/* Positions */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ padding: '14px', backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.3)' }}>
                    <div style={{ color: '#6ee7b7', fontSize: '12px' }}>LONG</div>
                    <div style={{ color: '#34d399', fontSize: '20px', fontWeight: 'bold' }}>{algoAnalysis.prediction.longAsset}</div>
                    {trendAnalysis[algoAnalysis.prediction.longAsset === asset1Info.symbol ? 'asset1' : 'asset2'] && <div style={{ color: getTrendColor(trendAnalysis[algoAnalysis.prediction.longAsset === asset1Info.symbol ? 'asset1' : 'asset2'].trend), fontSize: '11px', marginTop: '4px' }}>{trendAnalysis[algoAnalysis.prediction.longAsset === asset1Info.symbol ? 'asset1' : 'asset2'].trend.replace(/_/g, ' ')}</div>}
                  </div>
                  <div style={{ padding: '14px', backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <div style={{ color: '#fca5a5', fontSize: '12px' }}>SHORT</div>
                    <div style={{ color: '#f87171', fontSize: '20px', fontWeight: 'bold' }}>{algoAnalysis.prediction.shortAsset}</div>
                    {trendAnalysis[algoAnalysis.prediction.shortAsset === asset1Info.symbol ? 'asset1' : 'asset2'] && <div style={{ color: getTrendColor(trendAnalysis[algoAnalysis.prediction.shortAsset === asset1Info.symbol ? 'asset1' : 'asset2'].trend), fontSize: '11px', marginTop: '4px' }}>{trendAnalysis[algoAnalysis.prediction.shortAsset === asset1Info.symbol ? 'asset1' : 'asset2'].trend.replace(/_/g, ' ')}</div>}
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
                  <Box><div style={{ color: '#9ca3af', fontSize: '11px' }}>Gap</div><div style={{ color: 'white', fontWeight: 'bold' }}>{algoAnalysis.prediction.currentGap}%</div></Box>
                  <Box><div style={{ color: '#9ca3af', fontSize: '11px' }}>Target</div><div style={{ color: '#34d399', fontWeight: 'bold' }}>{algoAnalysis.prediction.targetGap}%</div></Box>
                  <Box><div style={{ color: '#9ca3af', fontSize: '11px' }}>Exp. Profit</div><div style={{ color: '#34d399', fontWeight: 'bold' }}>+{algoAnalysis.prediction.expProfit}%</div></Box>
                  <Box><div style={{ color: '#9ca3af', fontSize: '11px' }}>Stop Loss</div><div style={{ color: '#f87171', fontWeight: 'bold' }}>±{algoAnalysis.prediction.stopLoss}%</div></Box>
                  <Box><div style={{ color: '#9ca3af', fontSize: '11px' }}>Risk</div><div style={{ color: algoAnalysis.prediction.riskLevel === 'HIGH' ? '#f87171' : algoAnalysis.prediction.riskLevel === 'MEDIUM' ? '#fbbf24' : '#34d399', fontWeight: 'bold' }}>{algoAnalysis.prediction.riskLevel}</div></Box>
                </div>
              </div>
            ) : (
              <div style={{ borderRadius: '10px', padding: '20px', background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(127,29,29,0.1))', border: '1px solid rgba(239,68,68,0.3)' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f87171', marginBottom: '8px' }}>🚫 NO TRADE SIGNAL</div>
                <div style={{ color: '#fca5a5', fontSize: '14px' }}>{algoAnalysis.prediction.reason}</div>
              </div>
            )}
          </div>
        )}

        {/* Backtest */}
        {backtestResults && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '20px' }}>
            <h3 style={{ color: 'white', fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={20} color="#60a5fa" /> Backtest</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
              <Box><div style={{ color: '#9ca3af', fontSize: '11px' }}>Win Rate</div><div style={{ color: backtestResults.winRate >= 60 ? '#34d399' : backtestResults.winRate >= 50 ? '#fbbf24' : '#f87171', fontWeight: 'bold', fontSize: '20px' }}>{backtestResults.winRate}%</div></Box>
              <Box><div style={{ color: '#9ca3af', fontSize: '11px' }}>Trades</div><div style={{ color: 'white', fontWeight: 'bold', fontSize: '20px' }}>{backtestResults.total}</div></Box>
              <Box><div style={{ color: '#9ca3af', fontSize: '11px' }}>W/L</div><div style={{ color: 'white', fontWeight: 'bold', fontSize: '20px' }}>{backtestResults.wins}/{backtestResults.losses}</div></Box>
              <Box><div style={{ color: '#9ca3af', fontSize: '11px' }}>Profit Factor</div><div style={{ color: backtestResults.pf >= 1.5 ? '#34d399' : backtestResults.pf >= 1 ? '#fbbf24' : '#f87171', fontWeight: 'bold', fontSize: '20px' }}>{backtestResults.pf}</div></Box>
            </div>
          </div>
        )}

        {/* Settings */}
        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '20px' }}>
          <h3 style={{ color: 'white', fontSize: '16px', marginBottom: '12px' }}>Settings</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Asset 1</label>
              <select value={asset1} onChange={e => setAsset1(e.target.value)} style={{ width: '100%', padding: '8px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '6px' }}>
                {CRYPTO_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Asset 2</label>
              <select value={asset2} onChange={e => setAsset2(e.target.value)} style={{ width: '100%', padding: '8px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '6px' }}>
                {CRYPTO_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Interval</label>
              <select value={interval} onChange={e => setInterval(e.target.value)} style={{ width: '100%', padding: '8px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '6px' }}>
                {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Min Win%</label>
              <input type="number" value={thresholds.minWinRate} onChange={e => setThresholds({...thresholds, minWinRate: +e.target.value})} style={{ width: '100%', padding: '8px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '6px' }} />
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Min PF</label>
              <input type="number" value={thresholds.minProfitFactor} onChange={e => setThresholds({...thresholds, minProfitFactor: +e.target.value})} step="0.1" style={{ width: '100%', padding: '8px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '6px' }} />
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Min Gap%</label>
              <input type="number" value={thresholds.minGap} onChange={e => setThresholds({...thresholds, minGap: +e.target.value})} step="0.1" style={{ width: '100%', padding: '8px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '6px' }} />
            </div>
          </div>
          {error && <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'rgba(239,68,68,0.2)', borderRadius: '6px', color: '#fca5a5', fontSize: '13px' }}>Error: {error}</div>}
        </div>

        {/* Timeframe */}
        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '12px 20px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['1D', '7D', '1M', '3M', '6M', '1Y'].map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: timeframe === tf ? '#2563eb' : '#374151', color: timeframe === tf ? 'white' : '#9ca3af', fontSize: '13px' }}>{tf}</button>
            ))}
          </div>
        </div>

        {/* Charts */}
        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '20px' }}>
          <h3 style={{ color: 'white', fontSize: '16px', marginBottom: '12px' }}>Performance</h3>
          {loading ? <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading...</div> : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} stroke="#4b5563" />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} stroke="#4b5563" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                <Legend />
                <Line type="monotone" dataKey="asset1Daily" stroke={asset1Info.color} name={asset1Info.symbol} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="asset2Daily" stroke={asset2Info.color} name={asset2Info.symbol} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', borderBottom: '1px solid #374151', borderRadius: '0 0 12px 12px', padding: '20px' }}>
          <h3 style={{ color: 'white', fontSize: '16px', marginBottom: '12px' }}>Gap (Mean: {avgDiff}%)</h3>
          {loading ? <div style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading...</div> : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} stroke="#4b5563" />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} stroke="#4b5563" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                <Legend />
                <Line type="monotone" dataKey="diff" stroke="#10b981" name="Gap %" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
