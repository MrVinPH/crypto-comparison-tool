import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { RefreshCw, Brain, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

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
  { value: '15m', label: '15m' }, { value: '1h', label: '1H' },
  { value: '4h', label: '4H' }, { value: '1d', label: '1D' }, { value: '1w', label: '1W' },
];

export default function App() {
  const [data, setData] = useState([]);
  const [timeframe, setTimeframe] = useState('7D');
  const [interval, setIntvl] = useState('1d');
  const [asset1, setAsset1] = useState('BTCUSDT');
  const [asset2, setAsset2] = useState('ETHUSDT');
  const [loading, setLoading] = useState(false);
  const [priceInfo, setPriceInfo] = useState({ asset1: null, asset2: null });
  const [prediction, setPrediction] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [mlData, setMlData] = useState(null);
  const [backtest, setBacktest] = useState(null); // eslint-disable-line no-unused-vars
  const [regimeStats, setRegimeStats] = useState(null);

  const getAsset = (id) => CRYPTO_OPTIONS.find(a => a.id === id) || CRYPTO_OPTIONS[0];

  const getLimit = (tf) => {
    const limits = { '1D': 24, '7D': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
    return limits[tf] || 30;
  };

  // SMA Calculator
  const calcSMA = (prices, period) => {
    if (prices.length < period) return null;
    return prices.slice(-period).reduce((a, b) => a + b, 0) / period;
  };

  // EMA Calculator
  const calcEMA = (prices, period) => {
    if (prices.length < period) return null;
    const k = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  };

  // RSI Calculator
  const calcRSI = (prices, period) => {
    if (prices.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    if (losses === 0) return 100;
    const rs = (gains / period) / (losses / period);
    return 100 - (100 / (1 + rs));
  };

  // Detect Market Trend
  const detectTrend = (prices) => {
    if (prices.length < 20) return { trend: 'UNKNOWN', strength: 0, rsi: 50, reversal: 'NONE' };
    
    const current = prices[prices.length - 1];
    const sma20 = calcSMA(prices, 20);
    const ema12 = calcEMA(prices, 12);
    const ema26 = calcEMA(prices, Math.min(26, prices.length));
    const rsi = calcRSI(prices, 14);
    
    const recent5 = prices.slice(-5);
    const change5 = ((recent5[recent5.length - 1] - recent5[0]) / recent5[0]) * 100;
    const recent20 = prices.slice(-20);
    const change20 = ((recent20[recent20.length - 1] - recent20[0]) / recent20[0]) * 100;
    
    let bullScore = 0, bearScore = 0;
    
    if (current > sma20) bullScore += 20; else bearScore += 20;
    if (ema12 > ema26) bullScore += 20; else bearScore += 20;
    if (rsi > 55) bullScore += 15; else if (rsi < 45) bearScore += 15;
    if (change5 > 0) bullScore += 15; else bearScore += 15;
    if (change20 > 0) bullScore += 15; else bearScore += 15;
    
    const total = bullScore + bearScore;
    const bullPct = (bullScore / total) * 100;
    
    let trend = 'SIDEWAYS';
    let strength = 50;
    
    if (bullPct >= 65) {
      trend = 'UPTREND';
      strength = Math.min(100, (bullPct - 50) * 2);
    } else if (bullPct <= 35) {
      trend = 'DOWNTREND';
      strength = Math.min(100, (50 - bullPct) * 2);
    }
    
    let reversal = 'NONE';
    if (rsi > 70) reversal = 'OVERBOUGHT';
    else if (rsi < 30) reversal = 'OVERSOLD';
    else if (trend === 'UPTREND' && change5 < -2) reversal = 'PULLBACK';
    else if (trend === 'DOWNTREND' && change5 > 2) reversal = 'BOUNCE';
    
    return {
      trend: trend,
      strength: strength.toFixed(0),
      rsi: rsi.toFixed(1),
      bullPct: bullPct.toFixed(0),
      change5: change5.toFixed(2),
      change20: change20.toFixed(2),
      aboveSMA: current > sma20,
      emaAlign: ema12 > ema26,
      reversal: reversal
    };
  };

  // ML Reversion Factor
  const calcReversion = (chartData) => {
    if (chartData.length < 20) return { factor: 0.6, samples: 0 };
    const diffs = chartData.map(d => d.diff);
    const samples = [];
    for (let i = 10; i < diffs.length - 3; i++) {
      const hist = diffs.slice(i - 10, i);
      const mean = hist.reduce((a, b) => a + b, 0) / 10;
      const std = Math.sqrt(hist.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / 10);
      const dev = diffs[i] - mean;
      if (Math.abs(dev) > std * 0.8 && Math.abs(dev) > 0.001) {
        const futDev = diffs[i + 2] - mean;
        const rev = 1 - (futDev / dev);
        if (rev > -0.5 && rev < 1.5) samples.push(rev);
      }
    }
    if (samples.length < 3) return { factor: 0.6, samples: 0 };
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    return { factor: Math.max(0.3, Math.min(0.9, avg)), samples: samples.length };
  };

  // Optimize Threshold
  const optimizeThreshold = (chartData) => {
    if (chartData.length < 20) return { threshold: 1.2, winRate: 0, trades: 0 };
    const diffs = chartData.map(d => d.diff);
    let best = { threshold: 1.2, winRate: 0, trades: 0, score: -1 };
    
    [0.8, 1.0, 1.2, 1.5, 2.0].forEach(th => {
      let w = 0, l = 0;
      for (let i = 10; i < diffs.length - 1; i++) {
        const hist = diffs.slice(i - 10, i);
        const mean = hist.reduce((a, b) => a + b, 0) / 10;
        const std = Math.sqrt(hist.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / 10);
        if (diffs[i] > mean + th * std) {
          if (diffs[i] - diffs[i + 1] > 0) w++; else l++;
        } else if (diffs[i] < mean - th * std) {
          if (diffs[i + 1] - diffs[i] > 0) w++; else l++;
        }
      }
      const total = w + l;
      if (total >= 3) {
        const wr = (w / total) * 100;
        const score = wr + total * 2;
        if (score > best.score) {
          best = { threshold: th, winRate: wr.toFixed(1), trades: total, score: score };
        }
      }
    });
    return best;
  };

  // Analyze by Regime
  const analyzeRegime = (chartData, btcPrices, a1, a2) => {
    if (chartData.length < 25 || btcPrices.length < 25) return null;
    
    const up = { a1Wins: 0, a2Wins: 0, count: 0 };
    const down = { a1Wins: 0, a2Wins: 0, count: 0 };
    
    for (let i = 20; i < chartData.length - 1; i++) {
      const slice = btcPrices.slice(i - 20, i);
      const sma = slice.reduce((a, b) => a + b, 0) / 20;
      const price = btcPrices[i];
      const isUp = price > sma;
      
      const a1Change = chartData[i + 1].asset1Daily - chartData[i].asset1Daily;
      const a2Change = chartData[i + 1].asset2Daily - chartData[i].asset2Daily;
      
      if (isUp) {
        up.count++;
        if (a1Change > a2Change) up.a1Wins++; else up.a2Wins++;
      } else {
        down.count++;
        if (a1Change > a2Change) down.a1Wins++; else down.a2Wins++;
      }
    }
    
    return {
      uptrend: up.count > 3 ? { count: up.count, a1Rate: ((up.a1Wins / up.count) * 100).toFixed(0), a2Rate: ((up.a2Wins / up.count) * 100).toFixed(0), favors: up.a1Wins > up.a2Wins ? a1 : a2 } : null,
      downtrend: down.count > 3 ? { count: down.count, a1Rate: ((down.a1Wins / down.count) * 100).toFixed(0), a2Rate: ((down.a2Wins / down.count) * 100).toFixed(0), favors: down.a1Wins > down.a2Wins ? a1 : a2 } : null
    };
  };

  // Run Backtest
  const runBacktest = (chartData, th) => {
    if (chartData.length < 20) return null;
    const diffs = chartData.map(d => d.diff);
    let w = 0, l = 0, profit = 0;
    
    for (let i = 10; i < diffs.length - 1; i++) {
      const hist = diffs.slice(i - 10, i);
      const mean = hist.reduce((a, b) => a + b, 0) / 10;
      const std = Math.sqrt(hist.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / 10);
      
      if (diffs[i] > mean + th * std) {
        const pnl = diffs[i] - diffs[i + 1];
        profit += pnl;
        if (pnl > 0) w++; else l++;
      } else if (diffs[i] < mean - th * std) {
        const pnl = diffs[i + 1] - diffs[i];
        profit += pnl;
        if (pnl > 0) w++; else l++;
      }
    }
    
    const total = w + l;
    return {
      trades: total,
      wins: w,
      winRate: total > 0 ? ((w / total) * 100).toFixed(1) : '0',
      profit: profit.toFixed(2)
    };
  };

  // Generate Prediction
  const genPrediction = (chartData, trend, ml, a1Info, a2Info, prices1, prices2) => {
    if (!chartData.length || !priceInfo.asset1 || !priceInfo.asset2) return null;
    
    const lastDiff = priceInfo.asset2.changeTimeframe - priceInfo.asset1.changeTimeframe;
    const diffs = chartData.map(d => d.diff);
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const std = Math.sqrt(diffs.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / diffs.length);
    
    const revFactor = ml?.factor || 0.6;
    const marketTrend = trend?.trend || 'SIDEWAYS';
    const trendStrength = parseFloat(trend?.strength) || 0;
    
    // Base direction from gap
    let baseLong = lastDiff > 0 ? a1Info.symbol : a2Info.symbol;
    let baseShort = lastDiff > 0 ? a2Info.symbol : a1Info.symbol;
    
    // Trend adjustment
    let finalLong = baseLong;
    let finalShort = baseShort;
    let source = 'gap';
    let confAdj = 0;
    
    if (marketTrend === 'DOWNTREND' && trendStrength > 40) {
      // Downtrend: BTC stronger
      if (a1Info.symbol === 'BTC') {
        if (baseLong === 'BTC') { confAdj = 15; source = 'gap+trend'; }
        else if (trendStrength > 60) { finalLong = 'BTC'; finalShort = a2Info.symbol; source = 'trend'; confAdj = 5; }
        else { confAdj = -10; source = 'gap(conflict)'; }
      }
    } else if (marketTrend === 'UPTREND' && trendStrength > 40) {
      // Uptrend: Alts stronger
      if (a1Info.symbol === 'BTC') {
        if (baseLong === a2Info.symbol) { confAdj = 15; source = 'gap+trend'; }
        else if (trendStrength > 60) { finalLong = a2Info.symbol; finalShort = 'BTC'; source = 'trend'; confAdj = 5; }
        else { confAdj = -10; source = 'gap(conflict)'; }
      }
    }
    
    // Reversal check
    let reduceSize = false;
    if (trend?.reversal === 'OVERBOUGHT' || trend?.reversal === 'OVERSOLD') {
      confAdj -= 15;
      reduceSize = true;
    }
    
    const expMove = lastDiff > mean ? -(Math.abs(lastDiff - mean) * revFactor) : Math.abs(lastDiff - mean) * revFactor;
    const target = lastDiff + expMove;
    
    let conf = 55 + confAdj;
    if (Math.abs(lastDiff) > std) conf += 10;
    conf = Math.max(20, Math.min(95, conf));
    
    const shouldTrade = Math.abs(lastDiff - mean) > std * 0.5;
    
    if (!shouldTrade) {
      return {
        action: 'SKIP',
        reason: 'Gap too small - no significant deviation from mean',
        trend: marketTrend,
        gap: lastDiff.toFixed(2)
      };
    }
    
    return {
      action: 'TRADE',
      long: finalLong,
      short: finalShort,
      source: source,
      confidence: conf.toFixed(0),
      gap: lastDiff.toFixed(2),
      target: target.toFixed(2),
      expected: Math.abs(expMove).toFixed(2),
      trend: marketTrend,
      trendStrength: trendStrength.toFixed(0),
      reversal: trend?.reversal || 'NONE',
      sizing: reduceSize ? 'REDUCED' : 'NORMAL',
      risk: std > 2 ? 'HIGH' : std > 1 ? 'MEDIUM' : 'LOW'
    };
  };

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const a1 = getAsset(asset1);
      const a2 = getAsset(asset2);
      const limit = getLimit(timeframe);
      const intv = interval;
      
      const [r1, r2] = await Promise.all([
        fetch('https://api.binance.com/api/v3/klines?symbol=' + asset1 + '&interval=' + intv + '&limit=' + limit),
        fetch('https://api.binance.com/api/v3/klines?symbol=' + asset2 + '&interval=' + intv + '&limit=' + limit)
      ]);
      
      const d1 = await r1.json();
      const d2 = await r2.json();
      
      if (!d1.length || !d2.length) {
        setLoading(false);
        return;
      }
      
      // Get BTC for trend
      let btcData = d1;
      if (asset1 !== 'BTCUSDT') {
        const rBtc = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=' + intv + '&limit=' + limit);
        btcData = await rBtc.json();
      }
      
      const sp1 = parseFloat(d1[0][4]);
      const sp2 = parseFloat(d2[0][4]);
      const cp1 = parseFloat(d1[d1.length - 1][4]);
      const cp2 = parseFloat(d2[d2.length - 1][4]);
      
      const pInfo = {
        asset1: { current: cp1, changeTimeframe: ((cp1 - sp1) / sp1) * 100 },
        asset2: { current: cp2, changeTimeframe: ((cp2 - sp2) / sp2) * 100 }
      };
      setPriceInfo(pInfo);
      
      const prices1 = d1.map(k => parseFloat(k[4]));
      const prices2 = d2.map(k => parseFloat(k[4]));
      const btcPrices = btcData.map(k => parseFloat(k[4]));
      
      // Trend analysis
      const trend = detectTrend(btcPrices);
      setTrendData(trend);
      
      // Build chart data
      const minLen = Math.min(d1.length, d2.length);
      const chartData = [];
      for (let i = 0; i < minLen; i++) {
        const c1 = parseFloat(d1[i][4]);
        const c2 = parseFloat(d2[i][4]);
        const ch1 = ((c1 - sp1) / sp1) * 100;
        const ch2 = ((c2 - sp2) / sp2) * 100;
        const dt = new Date(d1[i][0]);
        chartData.push({
          date: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          asset1Daily: parseFloat(ch1.toFixed(2)),
          asset2Daily: parseFloat(ch2.toFixed(2)),
          diff: parseFloat((ch2 - ch1).toFixed(2))
        });
      }
      setData(chartData);
      
      // ML Analysis
      const rev = calcReversion(chartData);
      const thresh = optimizeThreshold(chartData);
      setMlData({ reversion: rev, threshold: thresh });
      
      // Backtest
      const bt = runBacktest(chartData, thresh.threshold);
      setBacktest(bt);
      
      // Regime analysis
      const regime = analyzeRegime(chartData, btcPrices, a1.symbol, a2.symbol);
      setRegimeStats(regime);
      
      // Prediction
      const pred = genPrediction(chartData, trend, rev, a1, a2, prices1, prices2);
      setPrediction(pred);
      
    } catch (err) {
      console.error('Error:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, interval, asset1, asset2]);

  const a1 = getAsset(asset1);
  const a2 = getAsset(asset2);
  const avgDiff = data.length > 0 ? (data.reduce((s, d) => s + d.diff, 0) / data.length).toFixed(2) : '0';

  return (
    <div style={{ minHeight: '100vh', background: '#111827', padding: 16 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ background: '#1f2937', borderRadius: '12px 12px 0 0', padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #374151' }}>
          <div>
            <h1 style={{ color: 'white', fontSize: 20, margin: 0 }}>ML Crypto Analyzer v3</h1>
            <p style={{ color: '#9ca3af', fontSize: 12, margin: 0 }}>Trend-Enhanced Trading</p>
          </div>
          <button onClick={loadData} disabled={loading} style={{ background: loading ? '#4b5563' : '#2563eb', color: 'white', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Trend Panel */}
        {trendData && (
          <div style={{ background: '#1f2937', padding: 16, borderLeft: '1px solid #374151', borderRight: '1px solid #374151' }}>
            <div style={{ background: trendData.trend === 'UPTREND' ? 'rgba(34,197,94,0.15)' : trendData.trend === 'DOWNTREND' ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.15)', borderRadius: 10, padding: 16, border: '1px solid ' + (trendData.trend === 'UPTREND' ? '#22c55e' : trendData.trend === 'DOWNTREND' ? '#ef4444' : '#f59e0b') }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {trendData.trend === 'UPTREND' ? <TrendingUp color="#22c55e" size={24} /> : trendData.trend === 'DOWNTREND' ? <TrendingDown color="#ef4444" size={24} /> : <AlertTriangle color="#f59e0b" size={24} />}
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>Market: {trendData.trend}</div>
                  <div style={{ color: '#9ca3af', fontSize: 12 }}>
                    {trendData.trend === 'UPTREND' ? 'Alts may outperform BTC' : trendData.trend === 'DOWNTREND' ? 'BTC typically outperforms' : 'No clear direction'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>{trendData.strength}%</div>
                  <div style={{ color: '#9ca3af', fontSize: 10 }}>Strength</div>
                </div>
              </div>
              
              {trendData.reversal !== 'NONE' && (
                <div style={{ background: 'rgba(251,191,36,0.2)', padding: 8, borderRadius: 6, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle color="#fbbf24" size={16} />
                  <span style={{ color: '#fde68a', fontSize: 13 }}>{trendData.reversal} detected</span>
                </div>
              )}
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ color: '#9ca3af', fontSize: 10 }}>RSI</div>
                  <div style={{ color: parseFloat(trendData.rsi) > 70 ? '#ef4444' : parseFloat(trendData.rsi) < 30 ? '#22c55e' : 'white', fontWeight: 'bold' }}>{trendData.rsi}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ color: '#9ca3af', fontSize: 10 }}>vs SMA20</div>
                  <div style={{ color: trendData.aboveSMA ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>{trendData.aboveSMA ? '▲' : '▼'}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ color: '#9ca3af', fontSize: 10 }}>EMA</div>
                  <div style={{ color: trendData.emaAlign ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>{trendData.emaAlign ? 'Bull' : 'Bear'}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ color: '#9ca3af', fontSize: 10 }}>5-Bar</div>
                  <div style={{ color: parseFloat(trendData.change5) >= 0 ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>{trendData.change5}%</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ color: '#9ca3af', fontSize: 10 }}>20-Bar</div>
                  <div style={{ color: parseFloat(trendData.change20) >= 0 ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>{trendData.change20}%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ML Panel */}
        {mlData && (
          <div style={{ background: '#1f2937', padding: 16, borderLeft: '1px solid #374151', borderRight: '1px solid #374151' }}>
            <div style={{ background: 'rgba(139,92,246,0.15)', borderRadius: 10, padding: 16, border: '1px solid #8b5cf6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Brain color="#a78bfa" size={20} />
                <span style={{ color: 'white', fontWeight: 'bold' }}>ML Analysis</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 6 }}>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>Reversion Factor</div>
                  <div style={{ color: '#a78bfa', fontSize: 18, fontWeight: 'bold' }}>{(mlData.reversion.factor * 100).toFixed(0)}%</div>
                  <div style={{ color: '#6b7280', fontSize: 10 }}>{mlData.reversion.samples} samples</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 6 }}>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>Entry Threshold</div>
                  <div style={{ color: '#60a5fa', fontSize: 18, fontWeight: 'bold' }}>{mlData.threshold.threshold}σ</div>
                  <div style={{ color: '#6b7280', fontSize: 10 }}>{mlData.threshold.trades} trades</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 6 }}>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>Backtest Win Rate</div>
                  <div style={{ color: parseFloat(mlData.threshold.winRate) >= 50 ? '#22c55e' : '#ef4444', fontSize: 18, fontWeight: 'bold' }}>{mlData.threshold.winRate}%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trade Signal */}
        {prediction && (
          <div style={{ background: '#1f2937', padding: 16, borderLeft: '1px solid #374151', borderRight: '1px solid #374151' }}>
            {prediction.action === 'TRADE' ? (
              <div style={{ background: 'rgba(34,197,94,0.15)', borderRadius: 10, padding: 16, border: '2px solid #22c55e' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <Brain color="#22c55e" size={28} />
                  <div>
                    <div style={{ color: 'white', fontSize: 22, fontWeight: 'bold' }}>PAIRS TRADE</div>
                    <div style={{ color: '#9ca3af', fontSize: 12 }}>Confidence: {prediction.confidence}% | Source: {prediction.source}</div>
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div style={{ background: 'rgba(34,197,94,0.2)', padding: 12, borderRadius: 8 }}>
                    <div style={{ color: '#6ee7b7', fontSize: 11 }}>LONG</div>
                    <div style={{ color: '#22c55e', fontSize: 24, fontWeight: 'bold' }}>{prediction.long}</div>
                  </div>
                  <div style={{ background: 'rgba(239,68,68,0.2)', padding: 12, borderRadius: 8 }}>
                    <div style={{ color: '#fca5a5', fontSize: 11 }}>SHORT</div>
                    <div style={{ color: '#ef4444', fontSize: 24, fontWeight: 'bold' }}>{prediction.short}</div>
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ color: '#9ca3af', fontSize: 10 }}>Gap</div>
                    <div style={{ color: 'white', fontWeight: 'bold' }}>{prediction.gap}%</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ color: '#9ca3af', fontSize: 10 }}>Target</div>
                    <div style={{ color: '#22c55e', fontWeight: 'bold' }}>{prediction.target}%</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ color: '#9ca3af', fontSize: 10 }}>Expected</div>
                    <div style={{ color: '#22c55e', fontWeight: 'bold' }}>+{prediction.expected}%</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ color: '#9ca3af', fontSize: 10 }}>Size</div>
                    <div style={{ color: prediction.sizing === 'REDUCED' ? '#fbbf24' : '#22c55e', fontWeight: 'bold' }}>{prediction.sizing}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: 'rgba(239,68,68,0.15)', borderRadius: 10, padding: 16, border: '2px solid #ef4444' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 28 }}>🚫</div>
                  <div>
                    <div style={{ color: '#ef4444', fontSize: 20, fontWeight: 'bold' }}>NO TRADE</div>
                    <div style={{ color: '#fca5a5', fontSize: 13 }}>{prediction.reason}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Regime Stats */}
        {regimeStats && (regimeStats.uptrend || regimeStats.downtrend) && (
          <div style={{ background: '#1f2937', padding: 16, borderLeft: '1px solid #374151', borderRight: '1px solid #374151' }}>
            <div style={{ background: 'rgba(251,191,36,0.1)', borderRadius: 10, padding: 16, border: '1px solid #f59e0b' }}>
              <div style={{ color: '#fbbf24', fontWeight: 'bold', marginBottom: 10, fontSize: 13 }}>Historical Performance by Regime</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {regimeStats.uptrend && (
                  <div style={{ background: 'rgba(34,197,94,0.1)', padding: 10, borderRadius: 6 }}>
                    <div style={{ color: '#6ee7b7', fontSize: 11, marginBottom: 4 }}>UPTREND ({regimeStats.uptrend.count})</div>
                    <div style={{ color: '#d1d5db', fontSize: 12 }}>{a1.symbol}: {regimeStats.uptrend.a1Rate}%</div>
                    <div style={{ color: '#d1d5db', fontSize: 12 }}>{a2.symbol}: {regimeStats.uptrend.a2Rate}%</div>
                    <div style={{ color: '#22c55e', fontSize: 12, marginTop: 4 }}>Favors: {regimeStats.uptrend.favors}</div>
                  </div>
                )}
                {regimeStats.downtrend && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', padding: 10, borderRadius: 6 }}>
                    <div style={{ color: '#fca5a5', fontSize: 11, marginBottom: 4 }}>DOWNTREND ({regimeStats.downtrend.count})</div>
                    <div style={{ color: '#d1d5db', fontSize: 12 }}>{a1.symbol}: {regimeStats.downtrend.a1Rate}%</div>
                    <div style={{ color: '#d1d5db', fontSize: 12 }}>{a2.symbol}: {regimeStats.downtrend.a2Rate}%</div>
                    <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>Favors: {regimeStats.downtrend.favors}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div style={{ background: '#1f2937', padding: 16, borderLeft: '1px solid #374151', borderRight: '1px solid #374151' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div>
              <label style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 4 }}>Asset 1</label>
              <select value={asset1} onChange={e => setAsset1(e.target.value)} style={{ width: '100%', padding: 8, background: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: 6 }}>
                {CRYPTO_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 4 }}>Asset 2</label>
              <select value={asset2} onChange={e => setAsset2(e.target.value)} style={{ width: '100%', padding: 8, background: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: 6 }}>
                {CRYPTO_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 4 }}>Interval</label>
              <select value={interval} onChange={e => setIntvl(e.target.value)} style={{ width: '100%', padding: 8, background: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: 6 }}>
                {INTERVAL_OPTIONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {['1D', '7D', '1M', '3M', '6M', '1Y'].map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', background: timeframe === tf ? '#2563eb' : '#374151', color: 'white', fontSize: 12 }}>{tf}</button>
            ))}
          </div>
        </div>

        {/* Charts */}
        <div style={{ background: '#1f2937', padding: 16, borderLeft: '1px solid #374151', borderRight: '1px solid #374151' }}>
          <h3 style={{ color: 'white', fontSize: 14, marginBottom: 10 }}>Performance</h3>
          {loading ? (
            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="asset1Daily" stroke={a1.color} strokeWidth={2} name={a1.symbol} dot={false} />
                <Line type="monotone" dataKey="asset2Daily" stroke={a2.color} strokeWidth={2} name={a2.symbol} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background: '#1f2937', padding: 16, borderLeft: '1px solid #374151', borderRight: '1px solid #374151', borderBottom: '1px solid #374151', borderRadius: '0 0 12px 12px' }}>
          <h3 style={{ color: 'white', fontSize: 14, marginBottom: 10 }}>Gap (Mean: {avgDiff}%)</h3>
          {loading ? (
            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} />
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
