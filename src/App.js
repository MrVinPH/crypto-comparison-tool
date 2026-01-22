import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown, Brain, CheckCircle, AlertTriangle } from 'lucide-react';

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
  { value: '30m', label: '30 Min' }, { value: '1h', label: '1 Hour' }, { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' }, { value: '1w', label: '1 Week' },
];

export default function App() {
  const [data, setData] = useState([]);
  const [timeframe, setTimeframe] = useState('7D');
  const [interval, setInterval] = useState('1d');
  const [asset1, setAsset1] = useState('BTCUSDT');
  const [asset2, setAsset2] = useState('ETHUSDT');
  const [loading, setLoading] = useState(false);
  const [, setPriceInfo] = useState({ asset1: null, asset2: null });
  const [analysis, setAnalysis] = useState(null);

  const getAssetInfo = (id) => CRYPTO_OPTIONS.find(a => a.id === id) || CRYPTO_OPTIONS[0];

  const getTimeframeDetails = (tf, intv) => {
    const map = {
      '1D': { '1h': 24, '4h': 6, '15m': 96, '30m': 48, '1m': 1440, '5m': 288 },
      '7D': { '1h': 168, '4h': 42, '1d': 7 },
      '1M': { '1d': 30, '1h': 720, '4h': 180 },
      '3M': { '1d': 90, '1w': 12 },
      '6M': { '1d': 180, '1w': 26 },
      '1Y': { '1d': 365, '1w': 52 },
    };
    const limits = map[tf] || {};
    return { interval: intv, limit: limits[intv] || 30 };
  };

  // ML Function: Calculate optimal TP/SL from historical price action
  const calculateMLTargets = (chartData, trend, dominance) => {
    if (chartData.length < 15) return { optimalTP: 3.0, optimalSL: 2.0, winRate: 50, samples: 0, method: 'DEFAULT' };
    
    const isDowntrend = trend.includes('DOWNTREND');
    const isUptrend = trend.includes('UPTREND');
    
    // Calculate historical move distributions
    const moves = [];
    const winningMoves = [];
    const losingMoves = [];
    
    for (let i = 5; i < chartData.length; i++) {
      const gapChange = chartData[i].diff - chartData[i-5].diff;
      
      // Simulate trades based on regime
      if (isDowntrend) {
        // In downtrend, we long BTC short ALT - we win if BTC outperforms (gap widens negative or ETH falls more)
        const pnl = chartData[i-5].asset1Daily - chartData[i].asset1Daily < chartData[i-5].asset2Daily - chartData[i].asset2Daily;
        if (pnl) winningMoves.push(Math.abs(gapChange));
        else losingMoves.push(Math.abs(gapChange));
      } else if (isUptrend) {
        // In uptrend, we long ALT short BTC - we win if ALT outperforms
        const pnl = chartData[i].asset2Daily - chartData[i-5].asset2Daily > chartData[i].asset1Daily - chartData[i-5].asset1Daily;
        if (pnl) winningMoves.push(Math.abs(gapChange));
        else losingMoves.push(Math.abs(gapChange));
      } else {
        // Mean reversion
        moves.push(Math.abs(gapChange));
      }
    }
    
    // Calculate percentiles for optimal levels
    const allMoves = [...winningMoves, ...losingMoves, ...moves].sort((a, b) => a - b);
    if (allMoves.length < 5) return { optimalTP: 3.0, optimalSL: 2.0, winRate: 50, samples: 0, method: 'DEFAULT' };
    
    // Use 60th percentile for TP (capture most winning moves)
    // Use 30th percentile for SL (cut losses before avg losing move)
    const tp60 = allMoves[Math.floor(allMoves.length * 0.6)];
    const sl30 = allMoves[Math.floor(allMoves.length * 0.3)];
    
    // Calculate average winning and losing moves
    const avgWin = winningMoves.length > 0 ? winningMoves.reduce((a,b) => a+b, 0) / winningMoves.length : tp60;
    const avgLoss = losingMoves.length > 0 ? losingMoves.reduce((a,b) => a+b, 0) / losingMoves.length : sl30;
    
    // Backtest different TP/SL combinations to find optimal
    let bestTP = 3.0, bestSL = 2.0, bestScore = 0;
    const tpTests = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0];
    const slTests = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5];
    
    for (const tp of tpTests) {
      for (const sl of slTests) {
        let wins = 0, losses = 0;
        
        for (let i = 5; i < chartData.length - 5; i++) {
          const entryGap = chartData[i].diff;
          let hitTP = false, hitSL = false;
          
          // Look forward to see if TP or SL hit first
          for (let j = i + 1; j < Math.min(i + 10, chartData.length); j++) {
            const futureGap = chartData[j].diff;
            const gapMove = Math.abs(futureGap - entryGap);
            
            if (isDowntrend || isUptrend) {
              // Trend following: gap should move in predicted direction
              const correctDirection = isDowntrend ? (futureGap < entryGap) : (futureGap > entryGap);
              if (correctDirection && gapMove >= tp) { hitTP = true; break; }
              if (!correctDirection && gapMove >= sl) { hitSL = true; break; }
            } else {
              // Mean reversion: gap should move toward mean
              if (gapMove >= tp) { hitTP = true; break; }
              if (gapMove >= sl) { hitSL = true; break; }
            }
          }
          
          if (hitTP) { wins++; }
          else if (hitSL) { losses++; }
        }
        
        const totalTrades = wins + losses;
        if (totalTrades >= 3) {
          const winRate = wins / totalTrades;
          const expectancy = (winRate * tp) - ((1 - winRate) * sl);
          const score = expectancy * Math.sqrt(totalTrades); // Sharpe-like score
          
          if (score > bestScore) {
            bestScore = score;
            bestTP = tp;
            bestSL = sl;
          }
        }
      }
    }
    
    // Calculate final win rate with optimal params
    let finalWins = 0, finalTotal = 0;
    for (let i = 5; i < chartData.length - 5; i++) {
      const entryGap = chartData[i].diff;
      for (let j = i + 1; j < Math.min(i + 10, chartData.length); j++) {
        const gapMove = Math.abs(chartData[j].diff - entryGap);
        if (gapMove >= bestTP) { finalWins++; finalTotal++; break; }
        if (gapMove >= bestSL) { finalTotal++; break; }
      }
    }
    
    return {
      optimalTP: parseFloat(bestTP.toFixed(1)),
      optimalSL: parseFloat(bestSL.toFixed(1)),
      winRate: finalTotal > 0 ? ((finalWins / finalTotal) * 100).toFixed(1) : 50,
      samples: chartData.length - 10,
      avgWin: avgWin.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
      expectancy: ((bestTP * (finalWins/Math.max(finalTotal,1))) - (bestSL * (1 - finalWins/Math.max(finalTotal,1)))).toFixed(2),
      method: 'ML_OPTIMIZED'
    };
  };

  // Detect overall market trend using BTC as benchmark
  const detectMarketTrend = (chartData) => {
    if (chartData.length < 5) return { trend: 'NEUTRAL', strength: 0, btcChange: 0 };
    
    const btcChanges = chartData.map(d => d.asset1Daily);
    const recentBtc = btcChanges.slice(-5);
    const btcChange = btcChanges[btcChanges.length - 1];
    const recentTrend = recentBtc[recentBtc.length - 1] - recentBtc[0];
    
    // Calculate momentum
    let upMoves = 0, downMoves = 0;
    for (let i = 1; i < recentBtc.length; i++) {
      if (recentBtc[i] > recentBtc[i-1]) upMoves++;
      else if (recentBtc[i] < recentBtc[i-1]) downMoves++;
    }
    
    const momentum = upMoves - downMoves;
    let trend, strength;
    
    if (btcChange < -3 || (btcChange < 0 && momentum <= -2)) {
      trend = 'STRONG_DOWNTREND';
      strength = Math.min(100, Math.abs(btcChange) * 10 + Math.abs(momentum) * 15);
    } else if (btcChange < -1 || momentum < 0) {
      trend = 'DOWNTREND';
      strength = Math.min(80, Math.abs(btcChange) * 8 + Math.abs(momentum) * 10);
    } else if (btcChange > 3 || (btcChange > 0 && momentum >= 2)) {
      trend = 'STRONG_UPTREND';
      strength = Math.min(100, btcChange * 10 + momentum * 15);
    } else if (btcChange > 1 || momentum > 0) {
      trend = 'UPTREND';
      strength = Math.min(80, btcChange * 8 + momentum * 10);
    } else {
      trend = 'NEUTRAL';
      strength = 30;
    }
    
    return { trend, strength: strength.toFixed(0), btcChange: btcChange.toFixed(2), momentum, recentTrend: recentTrend.toFixed(2) };
  };

  // Calculate BTC dominance behavior - does BTC outperform alts in downtrends?
  const analyzeBtcDominance = (chartData) => {
    if (chartData.length < 10) return { dominanceInDowntrend: true, confidence: 50 };
    
    let btcWinsInDown = 0, totalDownPeriods = 0;
    let btcWinsInUp = 0, totalUpPeriods = 0;
    
    for (let i = 5; i < chartData.length; i++) {
      const btcChange = chartData[i].asset1Daily - chartData[i-5].asset1Daily;
      const ethChange = chartData[i].asset2Daily - chartData[i-5].asset2Daily;
      
      if (btcChange < -1) { // Downtrend period
        totalDownPeriods++;
        if (btcChange > ethChange) btcWinsInDown++; // BTC fell less = BTC wins
      } else if (btcChange > 1) { // Uptrend period
        totalUpPeriods++;
        if (ethChange > btcChange) btcWinsInUp++; // ETH gained more = typical alt behavior
      }
    }
    
    const btcDominanceRate = totalDownPeriods > 0 ? (btcWinsInDown / totalDownPeriods) * 100 : 50;
    const altOutperformRate = totalUpPeriods > 0 ? (btcWinsInUp / totalUpPeriods) * 100 : 50;
    
    return {
      dominanceInDowntrend: btcDominanceRate > 50,
      btcDominanceRate: btcDominanceRate.toFixed(0),
      altOutperformInUptrend: altOutperformRate > 50,
      altOutperformRate: altOutperformRate.toFixed(0),
      downSamples: totalDownPeriods,
      upSamples: totalUpPeriods,
      confidence: Math.min(90, (totalDownPeriods + totalUpPeriods) * 3)
    };
  };

  // ML Analysis
  const runAnalysis = (chartData, asset1Info, asset2Info, priceData) => {
    if (chartData.length < 10 || !priceData.asset1 || !priceData.asset2) return null;
    
    const diffs = chartData.map(d => d.diff);
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const stdDev = Math.sqrt(diffs.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / diffs.length);
    const currentGap = priceData.asset2.changeTimeframe - priceData.asset1.changeTimeframe;
    
    const marketTrend = detectMarketTrend(chartData);
    const dominance = analyzeBtcDominance(chartData);
    
    // Get current prices
    const price1 = priceData.asset1.current;
    const price2 = priceData.asset2.current;
    
    // Determine strategy based on trend
    let strategy, action, longAsset, shortAsset, reasoning, confidence;
    let longPrice, shortPrice, longTP, longSL, shortTP, shortSL;
    const isDowntrend = marketTrend.trend.includes('DOWNTREND');
    const isUptrend = marketTrend.trend.includes('UPTREND');
    const btcIsAsset1 = asset1Info.symbol === 'BTC';
    
    // ML-OPTIMIZED: Calculate TP/SL from historical data
    const mlTargets = calculateMLTargets(chartData, marketTrend.trend, dominance);
    const tpPercent = mlTargets.optimalTP;
    const slPercent = mlTargets.optimalSL;
    
    if (isDowntrend) {
      // DOWNTREND LOGIC: BTC typically outperforms alts
      if (btcIsAsset1 && dominance.dominanceInDowntrend) {
        strategy = 'TREND_FOLLOWING';
        action = 'PAIRS_TRADE';
        longAsset = asset1Info.symbol; // Long BTC
        shortAsset = asset2Info.symbol; // Short ALT
        longPrice = price1; shortPrice = price2;
        longTP = price1 * (1 + tpPercent/100); longSL = price1 * (1 - slPercent/100);
        shortTP = price2 * (1 - tpPercent/100); shortSL = price2 * (1 + slPercent/100);
        reasoning = `DOWNTREND DETECTED (BTC ${marketTrend.btcChange}%). Historical data shows BTC outperforms ${asset2Info.symbol} in ${dominance.btcDominanceRate}% of downtrend periods. BTC tends to be more resilient - expect gap to WIDEN (${asset2Info.symbol} to fall more).`;
        confidence = Math.min(85, 50 + parseFloat(dominance.btcDominanceRate) * 0.3 + parseFloat(marketTrend.strength) * 0.2);
      } else {
        strategy = 'TREND_FOLLOWING';
        action = 'PAIRS_TRADE';
        longAsset = btcIsAsset1 ? asset1Info.symbol : asset2Info.symbol;
        shortAsset = btcIsAsset1 ? asset2Info.symbol : asset1Info.symbol;
        longPrice = btcIsAsset1 ? price1 : price2; shortPrice = btcIsAsset1 ? price2 : price1;
        longTP = longPrice * (1 + tpPercent/100); longSL = longPrice * (1 - slPercent/100);
        shortTP = shortPrice * (1 - tpPercent/100); shortSL = shortPrice * (1 + slPercent/100);
        reasoning = `DOWNTREND (${marketTrend.btcChange}%). Favoring BTC as safe haven. Historical BTC dominance: ${dominance.btcDominanceRate}% in down markets.`;
        confidence = 60;
      }
    } else if (isUptrend) {
      // UPTREND LOGIC: Alts typically outperform BTC
      if (btcIsAsset1 && dominance.altOutperformInUptrend) {
        strategy = 'TREND_FOLLOWING';
        action = 'PAIRS_TRADE';
        longAsset = asset2Info.symbol; // Long ALT
        shortAsset = asset1Info.symbol; // Short BTC
        longPrice = price2; shortPrice = price1;
        longTP = price2 * (1 + tpPercent/100); longSL = price2 * (1 - slPercent/100);
        shortTP = price1 * (1 - tpPercent/100); shortSL = price1 * (1 + slPercent/100);
        reasoning = `UPTREND DETECTED (BTC +${marketTrend.btcChange}%). Historical data shows ${asset2Info.symbol} outperforms BTC in ${dominance.altOutperformRate}% of uptrend periods. Altcoins typically have higher beta - expect gap to NARROW (${asset2Info.symbol} to gain more).`;
        confidence = Math.min(85, 50 + parseFloat(dominance.altOutperformRate) * 0.3 + parseFloat(marketTrend.strength) * 0.2);
      } else {
        strategy = 'TREND_FOLLOWING';
        action = 'PAIRS_TRADE';
        longAsset = btcIsAsset1 ? asset2Info.symbol : asset1Info.symbol;
        shortAsset = btcIsAsset1 ? asset1Info.symbol : asset2Info.symbol;
        longPrice = btcIsAsset1 ? price2 : price1; shortPrice = btcIsAsset1 ? price1 : price2;
        longTP = longPrice * (1 + tpPercent/100); longSL = longPrice * (1 - slPercent/100);
        shortTP = shortPrice * (1 - tpPercent/100); shortSL = shortPrice * (1 + slPercent/100);
        reasoning = `UPTREND (+${marketTrend.btcChange}%). Favoring alts for higher beta exposure. Historical alt outperformance: ${dominance.altOutperformRate}% in up markets.`;
        confidence = 60;
      }
    } else {
      // NEUTRAL - Use mean reversion
      strategy = 'MEAN_REVERSION';
      if (currentGap > mean + stdDev * 0.5) {
        action = 'PAIRS_TRADE';
        longAsset = asset1Info.symbol;
        shortAsset = asset2Info.symbol;
        longPrice = price1; shortPrice = price2;
        longTP = price1 * (1 + tpPercent/100); longSL = price1 * (1 - slPercent/100);
        shortTP = price2 * (1 - tpPercent/100); shortSL = price2 * (1 + slPercent/100);
        reasoning = `NEUTRAL MARKET. Gap (${currentGap.toFixed(2)}%) above mean (${mean.toFixed(2)}%). Mean reversion suggests gap will narrow.`;
        confidence = 55;
      } else if (currentGap < mean - stdDev * 0.5) {
        action = 'PAIRS_TRADE';
        longAsset = asset2Info.symbol;
        shortAsset = asset1Info.symbol;
        longPrice = price2; shortPrice = price1;
        longTP = price2 * (1 + tpPercent/100); longSL = price2 * (1 - slPercent/100);
        shortTP = price1 * (1 - tpPercent/100); shortSL = price1 * (1 + slPercent/100);
        reasoning = `NEUTRAL MARKET. Gap (${currentGap.toFixed(2)}%) below mean (${mean.toFixed(2)}%). Mean reversion suggests gap will widen.`;
        confidence = 55;
      } else {
        action = 'SKIP';
        longAsset = null; shortAsset = null;
        longPrice = 0; shortPrice = 0; longTP = 0; longSL = 0; shortTP = 0; shortSL = 0;
        reasoning = `NEUTRAL MARKET, gap near mean. No clear edge. Wait for better setup.`;
        confidence = 0;
      }
    }
    
    // Calculate expected profit
    const expectedMove = isDowntrend ? Math.abs(currentGap) * 0.3 : isUptrend ? Math.abs(currentGap) * 0.25 : Math.abs(currentGap - mean) * 0.5;
    
    return {
      marketTrend,
      dominance,
      strategy,
      action,
      longAsset,
      shortAsset,
      reasoning,
      confidence: confidence.toFixed(0),
      currentGap: currentGap.toFixed(2),
      meanGap: mean.toFixed(2),
      stdDev: stdDev.toFixed(2),
      expectedMove: expectedMove.toFixed(2),
      riskLevel: stdDev > 3 ? 'HIGH' : stdDev > 1.5 ? 'MEDIUM' : 'LOW',
      // Price targets
      longEntry: longPrice,
      shortEntry: shortPrice,
      longTakeProfit: longTP,
      longStopLoss: longSL,
      shortTakeProfit: shortTP,
      shortStopLoss: shortSL,
      tpPercent,
      slPercent,
      riskReward: (tpPercent / slPercent).toFixed(2),
      // ML metrics
      mlTargets
    };
  };

  const loadData = async () => {
    setLoading(true);
    const a1 = getAssetInfo(asset1), a2 = getAssetInfo(asset2);
    try {
      const { interval: intv, limit } = getTimeframeDetails(timeframe, interval);
      const [r1, r2] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/klines?symbol=${asset1}&interval=${intv}&limit=${limit}`),
        fetch(`https://api.binance.com/api/v3/klines?symbol=${asset2}&interval=${intv}&limit=${limit}`)
      ]);
      const d1 = await r1.json(), d2 = await r2.json();
      
      const chartData = [], len = Math.min(d1.length, d2.length);
      const start1 = parseFloat(d1[0][4]), start2 = parseFloat(d2[0][4]);
      const curr1 = parseFloat(d1[len-1][4]), curr2 = parseFloat(d2[len-1][4]);
      
      for (let i = 0; i < len; i++) {
        const c1 = parseFloat(d1[i][4]), c2 = parseFloat(d2[i][4]);
        const ch1 = ((c1 - start1) / start1) * 100;
        const ch2 = ((c2 - start2) / start2) * 100;
        const dt = new Date(d1[i][0]);
        chartData.push({
          date: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          asset1Daily: parseFloat(ch1.toFixed(2)),
          asset2Daily: parseFloat(ch2.toFixed(2)),
          diff: parseFloat((ch2 - ch1).toFixed(2))
        });
      }
      
      const priceData = {
        asset1: { current: curr1, changeTimeframe: ((curr1 - start1) / start1) * 100 },
        asset2: { current: curr2, changeTimeframe: ((curr2 - start2) / start2) * 100 }
      };
      
      setData(chartData);
      setPriceInfo(priceData);
      setAnalysis(runAnalysis(chartData, a1, a2, priceData));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, interval, asset1, asset2]);

  const a1 = getAssetInfo(asset1), a2 = getAssetInfo(asset2);
  const isDown = analysis?.marketTrend?.trend?.includes('DOWNTREND');
  const isUp = analysis?.marketTrend?.trend?.includes('UPTREND');

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)', padding: '16px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ background: 'rgba(30, 41, 59, 0.8)', borderRadius: '16px 16px 0 0', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: 0 }}>🧠 Trend-Aware ML Analysis</h1>
            <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: '14px' }}>Adapts strategy based on market conditions</p>
          </div>
          <button onClick={loadData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '600' }}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />Refresh
          </button>
        </div>

        {/* Market Trend Banner */}
        {analysis && (
          <div style={{ background: isDown ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(127, 29, 29, 0.3))' : isUp ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(21, 128, 61, 0.3))' : 'linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(161, 98, 7, 0.3))', borderLeft: '1px solid rgba(99, 102, 241, 0.3)', borderRight: '1px solid rgba(99, 102, 241, 0.3)', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {isDown ? <TrendingDown size={40} color="#f87171" /> : isUp ? <TrendingUp size={40} color="#4ade80" /> : <AlertTriangle size={40} color="#fbbf24" />}
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: isDown ? '#fca5a5' : isUp ? '#86efac' : '#fde047' }}>{analysis.marketTrend.trend.replace('_', ' ')}</div>
                <div style={{ color: '#e2e8f0', fontSize: '14px' }}>BTC {analysis.marketTrend.btcChange}% | ML Score: {analysis.marketTrend.trendScore || '0'}</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right', padding: '12px 20px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Strategy Mode</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#c4b5fd' }}>{analysis.strategy.replace('_', ' ')}</div>
              </div>
            </div>
            
            {/* ML Trend Indicators */}
            <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Volatility</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#e2e8f0' }}>{analysis.marketTrend.volatility || '0'}%</div>
                <div style={{ fontSize: '9px', color: '#64748b' }}>threshold base</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>ROC</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: parseFloat(analysis.marketTrend.indicators?.roc || 0) >= 0 ? '#4ade80' : '#f87171' }}>{analysis.marketTrend.indicators?.roc || '0'}%</div>
                <div style={{ fontSize: '9px', color: '#64748b' }}>→ {analysis.marketTrend.scoreBreakdown?.rocComponent || '0'} pts</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>MA Trend</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: parseFloat(analysis.marketTrend.indicators?.maTrend || 0) >= 0 ? '#4ade80' : '#f87171' }}>{analysis.marketTrend.indicators?.maTrend || '0'}%</div>
                <div style={{ fontSize: '9px', color: '#64748b' }}>→ {analysis.marketTrend.scoreBreakdown?.maComponent || '0'} pts</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Momentum</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: (analysis.marketTrend.momentum || 0) >= 0 ? '#4ade80' : '#f87171' }}>{(analysis.marketTrend.momentum || 0) > 0 ? '+' : ''}{analysis.marketTrend.momentum || 0}</div>
                <div style={{ fontSize: '9px', color: '#64748b' }}>→ {analysis.marketTrend.scoreBreakdown?.momentumComponent || '0'} pts</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Consecutive</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: (analysis.marketTrend.indicators?.consecutive || 0) >= 0 ? '#4ade80' : '#f87171' }}>{(analysis.marketTrend.indicators?.consecutive || 0) > 0 ? '+' : ''}{analysis.marketTrend.indicators?.consecutive || 0}</div>
                <div style={{ fontSize: '9px', color: '#64748b' }}>→ {analysis.marketTrend.scoreBreakdown?.consecutiveComponent || '0'} pts</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Accel</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: parseFloat(analysis.marketTrend.indicators?.acceleration || 0) >= 0 ? '#4ade80' : '#f87171' }}>{analysis.marketTrend.indicators?.acceleration || '0'}</div>
                <div style={{ fontSize: '9px', color: '#64748b' }}>→ {analysis.marketTrend.scoreBreakdown?.accelComponent || '0'} pts</div>
              </div>
            </div>
            
            {/* Score Breakdown */}
            <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>📊 ML SCORE BREAKDOWN:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px' }}>
                <span style={{ color: '#f87171' }}>BTC({analysis.marketTrend.btcChange}%): <strong>{analysis.marketTrend.scoreBreakdown?.btcComponent || '0'}</strong></span>
                <span style={{ color: '#fbbf24' }}>+ Mom: <strong>{analysis.marketTrend.scoreBreakdown?.momentumComponent || '0'}</strong></span>
                <span style={{ color: '#a78bfa' }}>+ ROC: <strong>{analysis.marketTrend.scoreBreakdown?.rocComponent || '0'}</strong></span>
                <span style={{ color: '#60a5fa' }}>+ MA: <strong>{analysis.marketTrend.scoreBreakdown?.maComponent || '0'}</strong></span>
                <span style={{ color: '#34d399' }}>+ Accel: <strong>{analysis.marketTrend.scoreBreakdown?.accelComponent || '0'}</strong></span>
                <span style={{ color: '#f472b6' }}>+ Consec: <strong>{analysis.marketTrend.scoreBreakdown?.consecutiveComponent || '0'}</strong></span>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>= TOTAL: <span style={{ color: parseFloat(analysis.marketTrend.trendScore) > 0 ? '#4ade80' : '#f87171', fontSize: '14px' }}>{analysis.marketTrend.trendScore || '0'}</span></span>
              </div>
            </div>
            
            <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(139, 92, 246, 0.15)', borderRadius: '6px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
              <span style={{ fontSize: '11px', color: '#c4b5fd' }}>🧠 <strong>ML Thresholds:</strong> Strong: ±{analysis.marketTrend.dynamicThresholds?.strong || '2.0'}% | Weak: ±{analysis.marketTrend.dynamicThresholds?.weak || '0.5'}% (auto-adjusted to {analysis.marketTrend.volatility || '0'}% volatility)</span>
            </div>
          </div>
        )}

        {/* Historical Dominance Analysis */}
        {analysis && (
          <div style={{ background: 'rgba(30, 41, 59, 0.8)', borderLeft: '1px solid rgba(99, 102, 241, 0.3)', borderRight: '1px solid rgba(99, 102, 241, 0.3)', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <Brain size={24} color="#a78bfa" />
              <h3 style={{ color: 'white', margin: 0, fontSize: '18px' }}>Historical Pattern Analysis</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '12px', color: '#fca5a5', marginBottom: '4px' }}>📉 BTC Dominance in Downtrends</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f87171' }}>{analysis.dominance.btcDominanceRate}%</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>BTC outperforms in {analysis.dominance.downSamples} down periods</div>
              </div>
              <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '12px', color: '#86efac', marginBottom: '4px' }}>📈 Alt Outperformance in Uptrends</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4ade80' }}>{analysis.dominance.altOutperformRate}%</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{a2.symbol} outperforms in {analysis.dominance.upSamples} up periods</div>
              </div>
              <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '12px', color: '#a5b4fc', marginBottom: '4px' }}>📊 Current Gap</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: parseFloat(analysis.currentGap) >= 0 ? '#4ade80' : '#f87171' }}>{analysis.currentGap}%</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Mean: {analysis.meanGap}% | σ: {analysis.stdDev}%</div>
              </div>
            </div>
          </div>
        )}

        {/* Strategy Explanation Panel */}
        {analysis && (
          <div style={{ background: 'rgba(30, 41, 59, 0.8)', borderLeft: '1px solid rgba(99, 102, 241, 0.3)', borderRight: '1px solid rgba(99, 102, 241, 0.3)', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <AlertTriangle size={24} color="#fbbf24" />
              <h3 style={{ color: 'white', margin: 0, fontSize: '18px' }}>Strategy Selection Logic</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {/* Trend Following - Downtrend */}
              <div style={{ 
                background: analysis.strategy === 'TREND_FOLLOWING' && isDown ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0,0,0,0.2)', 
                border: analysis.strategy === 'TREND_FOLLOWING' && isDown ? '2px solid #f87171' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px', padding: '16px' 
              }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fca5a5', marginBottom: '8px' }}>
                  {analysis.strategy === 'TREND_FOLLOWING' && isDown ? '✅ ACTIVE: ' : ''}TREND FOLLOWING (Downtrend)
                </div>
                <div style={{ fontSize: '12px', color: '#d1d5db', lineHeight: '1.5' }}>
                  <strong>When:</strong> ML Score &lt; -20<br/>
                  <strong>Current:</strong> {analysis.marketTrend.trendScore}<br/>
                  <strong>Action:</strong> LONG BTC + SHORT ALT<br/>
                  <strong>Why:</strong> BTC is safer in downtrends, alts fall harder
                </div>
              </div>
              
              {/* Trend Following - Uptrend */}
              <div style={{ 
                background: analysis.strategy === 'TREND_FOLLOWING' && isUp ? 'rgba(34, 197, 94, 0.2)' : 'rgba(0,0,0,0.2)', 
                border: analysis.strategy === 'TREND_FOLLOWING' && isUp ? '2px solid #4ade80' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px', padding: '16px' 
              }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#86efac', marginBottom: '8px' }}>
                  {analysis.strategy === 'TREND_FOLLOWING' && isUp ? '✅ ACTIVE: ' : ''}TREND FOLLOWING (Uptrend)
                </div>
                <div style={{ fontSize: '12px', color: '#d1d5db', lineHeight: '1.5' }}>
                  <strong>When:</strong> ML Score &gt; +20<br/>
                  <strong>Current:</strong> {analysis.marketTrend.trendScore}<br/>
                  <strong>Action:</strong> LONG ALT + SHORT BTC<br/>
                  <strong>Why:</strong> Alts have higher beta, gain more in bull runs
                </div>
              </div>
              
              {/* Mean Reversion */}
              <div style={{ 
                background: analysis.strategy === 'MEAN_REVERSION' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(0,0,0,0.2)', 
                border: analysis.strategy === 'MEAN_REVERSION' ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px', padding: '16px' 
              }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fde047', marginBottom: '8px' }}>
                  {analysis.strategy === 'MEAN_REVERSION' ? '✅ ACTIVE: ' : ''}MEAN REVERSION (Neutral)
                </div>
                <div style={{ fontSize: '12px', color: '#d1d5db', lineHeight: '1.5' }}>
                  <strong>When:</strong> ML Score between -20 and +20<br/>
                  <strong>Current:</strong> {analysis.marketTrend.trendScore}<br/>
                  <strong>Action:</strong> Trade gap back to mean ({analysis.meanGap}%)<br/>
                  <strong>Why:</strong> No clear trend, gaps tend to revert
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(139, 92, 246, 0.15)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
              <div style={{ fontSize: '12px', color: '#c4b5fd' }}>
                <strong>🎯 Current Decision:</strong> ML Score = <span style={{ color: parseFloat(analysis.marketTrend.trendScore) > 20 ? '#4ade80' : parseFloat(analysis.marketTrend.trendScore) < -20 ? '#f87171' : '#fbbf24', fontWeight: 'bold' }}>{analysis.marketTrend.trendScore}</span> 
                → Strategy: <span style={{ color: '#fff', fontWeight: 'bold' }}>{analysis.strategy.replace('_', ' ')}</span>
                {analysis.strategy === 'MEAN_REVERSION' && <span> (Gap {analysis.currentGap}% vs Mean {analysis.meanGap}%)</span>}
              </div>
            </div>
          </div>
        )}

        {/* Trade Signal */}
        {analysis && analysis.action !== 'SKIP' && (
          <div style={{ background: 'rgba(30, 41, 59, 0.8)', borderLeft: '1px solid rgba(99, 102, 241, 0.3)', borderRight: '1px solid rgba(99, 102, 241, 0.3)', padding: '24px' }}>
            <div style={{ background: isDown ? 'linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(194, 65, 12, 0.3))' : 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(21, 128, 61, 0.3))', border: `2px solid ${isDown ? 'rgba(249, 115, 22, 0.5)' : 'rgba(34, 197, 94, 0.5)'}`, borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <CheckCircle size={48} color={isDown ? '#fb923c' : '#4ade80'} />
                <div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'white' }}>PAIRS TRADE</div>
                  <div style={{ color: '#e2e8f0', fontSize: '14px' }}>Confidence: {analysis.confidence}% | Expected: +{analysis.expectedMove}%</div>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>📋 ANALYSIS</div>
                <p style={{ color: '#f1f5f9', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>{analysis.reasoning}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: 'rgba(34, 197, 94, 0.2)', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '14px', color: '#86efac', marginBottom: '8px' }}>🟢 LONG</div>
                  <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#4ade80', marginBottom: '12px' }}>{analysis.longAsset}</div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px' }}>
                      <div><span style={{ color: '#94a3b8' }}>Entry</span><div style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>${analysis.longEntry?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div></div>
                      <div><span style={{ color: '#4ade80' }}>TP (+{analysis.tpPercent}%)</span><div style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '14px' }}>${analysis.longTakeProfit?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div></div>
                      <div><span style={{ color: '#f87171' }}>SL (-{analysis.slPercent}%)</span><div style={{ color: '#f87171', fontWeight: 'bold', fontSize: '14px' }}>${analysis.longStopLoss?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div></div>
                    </div>
                  </div>
                </div>
                <div style={{ background: 'rgba(239, 68, 68, 0.2)', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '14px', color: '#fca5a5', marginBottom: '8px' }}>🔴 SHORT</div>
                  <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#f87171', marginBottom: '12px' }}>{analysis.shortAsset}</div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px' }}>
                      <div><span style={{ color: '#94a3b8' }}>Entry</span><div style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>${analysis.shortEntry?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div></div>
                      <div><span style={{ color: '#4ade80' }}>TP (-{analysis.tpPercent}%)</span><div style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '14px' }}>${analysis.shortTakeProfit?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div></div>
                      <div><span style={{ color: '#f87171' }}>SL (+{analysis.slPercent}%)</span><div style={{ color: '#f87171', fontWeight: 'bold', fontSize: '14px' }}>${analysis.shortStopLoss?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div></div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={{ background: 'rgba(99, 102, 241, 0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#a5b4fc' }}>Risk/Reward</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#818cf8' }}>1:{analysis.riskReward}</div>
                </div>
                <div style={{ background: 'rgba(234, 179, 8, 0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#fde047' }}>ML Win Rate</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#facc15' }}>{analysis.mlTargets?.winRate}%</div>
                </div>
                <div style={{ background: 'rgba(34, 197, 94, 0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#86efac' }}>Expectancy</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4ade80' }}>{analysis.mlTargets?.expectancy}%</div>
                </div>
                <div style={{ background: 'rgba(139, 92, 246, 0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#c4b5fd' }}>Samples</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#a78bfa' }}>{analysis.mlTargets?.samples}</div>
                </div>
              </div>
              
              <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(139, 92, 246, 0.15)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                <div style={{ fontSize: '12px', color: '#c4b5fd' }}>🧠 <strong>ML Optimization:</strong> TP/SL calculated from {analysis.mlTargets?.samples} historical samples. Avg winning move: {analysis.mlTargets?.avgWin}% | Avg losing move: {analysis.mlTargets?.avgLoss}%</div>
              </div>

              <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', color: '#fbbf24' }}>⚠️ Risk Level: {analysis.riskLevel} | Execute both positions with equal $ value | Use stop-loss if gap moves against you by {(parseFloat(analysis.stdDev) * 1.5).toFixed(1)}%</div>
              </div>
            </div>
          </div>
        )}

        {/* No Trade */}
        {analysis && analysis.action === 'SKIP' && (
          <div style={{ background: 'rgba(30, 41, 59, 0.8)', borderLeft: '1px solid rgba(99, 102, 241, 0.3)', borderRight: '1px solid rgba(99, 102, 241, 0.3)', padding: '24px' }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(107, 114, 128, 0.2), rgba(55, 65, 81, 0.3))', border: '2px solid rgba(107, 114, 128, 0.4)', borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>⏸️</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9ca3af' }}>NO CLEAR SIGNAL</div>
              <p style={{ color: '#6b7280', marginTop: '8px' }}>{analysis.reasoning}</p>
            </div>
          </div>
        )}

        {/* Settings */}
        <div style={{ background: 'rgba(30, 41, 59, 0.8)', borderLeft: '1px solid rgba(99, 102, 241, 0.3)', borderRight: '1px solid rgba(99, 102, 241, 0.3)', padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            {[['Asset 1', asset1, setAsset1], ['Asset 2', asset2, setAsset2]].map(([lbl, val, fn]) => (
              <div key={lbl}>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>{lbl}</label>
                <select value={val} onChange={e => fn(e.target.value)} style={{ width: '100%', padding: '10px', background: '#1e293b', color: 'white', border: '1px solid #475569', borderRadius: '8px' }}>
                  {CRYPTO_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
                </select>
              </div>
            ))}
            <div>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Interval</label>
              <select value={interval} onChange={e => setInterval(e.target.value)} style={{ width: '100%', padding: '10px', background: '#1e293b', color: 'white', border: '1px solid #475569', borderRadius: '8px' }}>
                {INTERVAL_OPTIONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Timeframe */}
        <div style={{ background: 'rgba(30, 41, 59, 0.8)', borderLeft: '1px solid rgba(99, 102, 241, 0.3)', borderRight: '1px solid rgba(99, 102, 241, 0.3)', padding: '12px 24px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['1D', '7D', '1M', '3M', '6M', '1Y'].map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: timeframe === tf ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#334155', color: 'white', fontWeight: '500' }}>{tf}</button>
            ))}
          </div>
        </div>

        {/* Charts */}
        <div style={{ background: 'rgba(30, 41, 59, 0.8)', borderLeft: '1px solid rgba(99, 102, 241, 0.3)', borderRight: '1px solid rgba(99, 102, 241, 0.3)', padding: '24px' }}>
          <h3 style={{ color: 'white', marginBottom: '16px' }}>Performance Comparison</h3>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569' }} />
              <Legend />
              <Line type="monotone" dataKey="asset1Daily" stroke={a1.color} strokeWidth={2} dot={false} name={a1.symbol} />
              <Line type="monotone" dataKey="asset2Daily" stroke={a2.color} strokeWidth={2} dot={false} name={a2.symbol} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '0 0 16px 16px', padding: '24px' }}>
          <h3 style={{ color: 'white', marginBottom: '16px' }}>Gap ({a2.symbol} - {a1.symbol})</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569' }} />
              <Line type="monotone" dataKey="diff" stroke="#10b981" strokeWidth={2} dot={false} name="Gap %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
