import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown, ArrowUpCircle, Brain, CheckCircle } from 'lucide-react';

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
  { value: '1m', label: '1 Minute' },
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '30m', label: '30 Minutes' },
  { value: '1h', label: '1 Hour' },
  { value: '2h', label: '2 Hours' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' },
  { value: '1w', label: '1 Week' },
];

function App() {
  const [data, setData] = useState([]);
  const [timeframe, setTimeframe] = useState('7D');
  const [interval, setInterval] = useState('1d');
  const [asset1, setAsset1] = useState('BTCUSDT');
  const [asset2, setAsset2] = useState('ETHUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tradingSignal, setTradingSignal] = useState(null);
  const [priceInfo, setPriceInfo] = useState({ asset1: null, asset2: null });
  const [algoAnalysis, setAlgoAnalysis] = useState(null);
  const [backtestResults, setBacktestResults] = useState(null);

  const getAssetInfo = (assetId) => CRYPTO_OPTIONS.find(a => a.id === assetId) || CRYPTO_OPTIONS[0];

  const getTimeframeDetails = (tf, selectedInterval) => {
    switch(tf) {
      case '1D': return { interval: selectedInterval, limit: selectedInterval === '1h' ? 24 : selectedInterval === '2h' ? 12 : selectedInterval === '4h' ? 6 : selectedInterval === '15m' ? 96 : selectedInterval === '30m' ? 48 : selectedInterval === '1m' ? 1440 : selectedInterval === '5m' ? 288 : 24 };
      case '7D': return { interval: selectedInterval, limit: selectedInterval === '1h' ? 168 : selectedInterval === '2h' ? 84 : selectedInterval === '4h' ? 42 : selectedInterval === '1d' ? 7 : 168 };
      case '1M': return { interval: selectedInterval, limit: selectedInterval === '1d' ? 30 : selectedInterval === '1h' ? 720 : selectedInterval === '4h' ? 180 : 30 };
      case '3M': return { interval: selectedInterval === '1d' || selectedInterval === '1w' ? selectedInterval : '1d', limit: selectedInterval === '1w' ? 12 : 90 };
      case '6M': return { interval: selectedInterval === '1d' || selectedInterval === '1w' ? selectedInterval : '1d', limit: selectedInterval === '1w' ? 26 : 180 };
      case '1Y': return { interval: selectedInterval === '1d' || selectedInterval === '1w' ? selectedInterval : '1d', limit: selectedInterval === '1w' ? 52 : 365 };
      case 'YTD': {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const daysSinceYearStart = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
        return { interval: selectedInterval === '1d' || selectedInterval === '1w' ? selectedInterval : '1d', limit: selectedInterval === '1w' ? Math.ceil(daysSinceYearStart / 7) : daysSinceYearStart };
      }
      default: return { interval: selectedInterval, limit: 7 };
    }
  };

  // Advanced Pattern Recognition
  const detectPatterns = (chartData) => {
    if (chartData.length < 10) return [];
    
    const patterns = [];
    const diffs = chartData.map(d => d.diff);
    
    // Trend Detection
    const recentDiffs = diffs.slice(-5);
    const trend = recentDiffs.reduce((sum, val) => sum + val, 0) / recentDiffs.length;
    
    // Mean Reversion Pattern
    const mean = diffs.reduce((sum, val) => sum + val, 0) / diffs.length;
    const stdDev = Math.sqrt(diffs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / diffs.length);
    const lastDiff = diffs[diffs.length - 1];
    
    if (Math.abs(lastDiff - mean) > 1.5 * stdDev) {
      patterns.push({
        type: 'MEAN_REVERSION',
        strength: Math.min(Math.abs(lastDiff - mean) / stdDev * 30, 100),
        direction: lastDiff > mean ? 'SHORT' : 'LONG',
        description: `Gap ${lastDiff > mean ? 'above' : 'below'} mean by ${Math.abs(lastDiff - mean).toFixed(2)}%`
      });
    }
    
    // Momentum Pattern
    let consecutiveDirection = 0;
    for (let i = diffs.length - 1; i > diffs.length - 6 && i > 0; i--) {
      if ((diffs[i] - diffs[i-1]) * (diffs[i-1] - diffs[i-2]) > 0) {
        consecutiveDirection++;
      } else {
        break;
      }
    }
    
    if (consecutiveDirection >= 2) {
      const momentum = diffs[diffs.length - 1] > diffs[diffs.length - 2] ? 'POSITIVE' : 'NEGATIVE';
      patterns.push({
        type: 'MOMENTUM',
        strength: Math.min(consecutiveDirection * 25, 100),
        direction: momentum === 'POSITIVE' ? 'LONG' : 'SHORT',
        description: `${consecutiveDirection} consecutive moves in same direction`
      });
    }
    
    // Volatility Breakout
    const recentVolatility = recentDiffs.reduce((sum, val) => sum + Math.abs(val), 0) / recentDiffs.length;
    const historicalVolatility = diffs.slice(0, -5).reduce((sum, val) => sum + Math.abs(val), 0) / (diffs.length - 5);
    
    if (recentVolatility > historicalVolatility * 1.5) {
      patterns.push({
        type: 'VOLATILITY_BREAKOUT',
        strength: Math.min((recentVolatility / historicalVolatility) * 40, 100),
        direction: trend > 0 ? 'LONG' : 'SHORT',
        description: `Volatility increased by ${((recentVolatility / historicalVolatility - 1) * 100).toFixed(0)}%`
      });
    }
    
    // Support/Resistance Levels
    const sortedDiffs = [...diffs].sort((a, b) => a - b);
    const q1 = sortedDiffs[Math.floor(sortedDiffs.length * 0.25)];
    const q3 = sortedDiffs[Math.floor(sortedDiffs.length * 0.75)];
    
    if (lastDiff <= q1) {
      patterns.push({
        type: 'SUPPORT_LEVEL',
        strength: 70,
        direction: 'LONG',
        description: `Gap at lower quartile (support)`
      });
    } else if (lastDiff >= q3) {
      patterns.push({
        type: 'RESISTANCE_LEVEL',
        strength: 70,
        direction: 'SHORT',
        description: `Gap at upper quartile (resistance)`
      });
    }
    
    return patterns;
  };

  // Backtesting Engine
  const runBacktest = (chartData) => {
    if (chartData.length < 20) return null;
    
    let trades = [];
    let wins = 0;
    let losses = 0;
    let totalProfit = 0;
    
    const lookbackPeriod = 10;
    
    for (let i = lookbackPeriod; i < chartData.length - 1; i++) {
      const historicalData = chartData.slice(i - lookbackPeriod, i);
      const currentDiff = chartData[i].diff;
      const nextDiff = chartData[i + 1].diff;
      
      // Calculate mean and std dev
      const diffs = historicalData.map(d => d.diff);
      const mean = diffs.reduce((sum, val) => sum + val, 0) / diffs.length;
      const stdDev = Math.sqrt(diffs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / diffs.length);
      
      let entryPrice = currentDiff;
      let exitPrice = nextDiff;
      
      // Mean Reversion Strategy
      if (currentDiff > mean + 1.2 * stdDev) {
        const profitLoss = entryPrice - exitPrice;
        totalProfit += profitLoss;
        
        if (profitLoss > 0) wins++;
        else losses++;
        
        trades.push({
          entry: i,
          signal: 'SHORT_GAP',
          entryDiff: entryPrice,
          exitDiff: exitPrice,
          profitLoss: profitLoss,
          win: profitLoss > 0
        });
      } else if (currentDiff < mean - 1.2 * stdDev) {
        const profitLoss = exitPrice - entryPrice;
        totalProfit += profitLoss;
        
        if (profitLoss > 0) wins++;
        else losses++;
        
        trades.push({
          entry: i,
          signal: 'LONG_GAP',
          entryDiff: entryPrice,
          exitDiff: exitPrice,
          profitLoss: profitLoss,
          win: profitLoss > 0
        });
      }
    }
    
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
    const avgWin = wins > 0 ? trades.filter(t => t.win).reduce((sum, t) => sum + t.profitLoss, 0) / wins : 0;
    const avgLoss = losses > 0 ? Math.abs(trades.filter(t => !t.win).reduce((sum, t) => sum + t.profitLoss, 0) / losses) : 0;
    const profitFactor = avgLoss > 0 ? (avgWin * wins) / (avgLoss * losses) : wins > 0 ? 999 : 0;
    
    return {
      totalTrades: trades.length,
      wins,
      losses,
      winRate: winRate.toFixed(1),
      totalProfit: totalProfit.toFixed(2),
      avgWin: avgWin.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
      profitFactor: profitFactor.toFixed(2),
      recentTrades: trades.slice(-10)
    };
  };

  // Predictive Analysis
  const generatePrediction = (chartData, patterns, backtestResults, asset1Info, asset2Info) => {
    if (!chartData.length || !patterns.length || !backtestResults) return null;
    
    const lastDiff = chartData[chartData.length - 1].diff;
    const diffs = chartData.map(d => d.diff);
    const mean = diffs.reduce((sum, val) => sum + val, 0) / diffs.length;
    
    // Weighted scoring system
    let longScore = 0;
    let shortScore = 0;
    
    patterns.forEach(pattern => {
      const weight = pattern.strength / 100;
      if (pattern.direction === 'LONG') {
        longScore += weight * 20;
      } else if (pattern.direction === 'SHORT') {
        shortScore += weight * 20;
      }
    });
    
    // Backtest reliability factor
    const reliabilityMultiplier = parseFloat(backtestResults.winRate) / 100;
    longScore *= reliabilityMultiplier;
    shortScore *= reliabilityMultiplier;
    
    // Mean reversion bias
    if (lastDiff > mean + 0.5) {
      shortScore += 15;
    } else if (lastDiff < mean - 0.5) {
      longScore += 15;
    }
    
    // Determine action
    let action, targetAsset, confidence, reasoning;
    
    if (longScore > shortScore && longScore > 30) {
      if (lastDiff > 0) {
        action = 'LONG';
        targetAsset = asset2Info.symbol;
        reasoning = `${asset2Info.symbol} showing strength. Gap likely to widen further.`;
      } else {
        action = 'LONG';
        targetAsset = asset1Info.symbol;
        reasoning = `${asset1Info.symbol} oversold. Gap likely to narrow in favor of ${asset1Info.symbol}.`;
      }
      confidence = Math.min(longScore, 100);
    } else if (shortScore > longScore && shortScore > 30) {
      if (lastDiff > 0) {
        action = 'LONG';
        targetAsset = asset1Info.symbol;
        reasoning = `${asset2Info.symbol} overbought. Gap likely to narrow in favor of ${asset1Info.symbol}.`;
      } else {
        action = 'LONG';
        targetAsset = asset2Info.symbol;
        reasoning = `Mean reversion expected. Gap likely to shift toward ${asset2Info.symbol}.`;
      }
      confidence = Math.min(shortScore, 100);
    } else {
      action = 'HOLD';
      targetAsset = 'NONE';
      reasoning = 'Insufficient edge detected. Wait for clearer signal.';
      confidence = 0;
    }
    
    // Risk assessment
    const volatility = Math.sqrt(diffs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / diffs.length);
    const riskLevel = volatility > 2 ? 'HIGH' : volatility > 1 ? 'MEDIUM' : 'LOW';
    
    // Expected outcome
    const expectedMove = lastDiff > mean ? -(Math.abs(lastDiff - mean) * 0.6) : Math.abs(lastDiff - mean) * 0.6;
    const targetPrice = lastDiff + expectedMove;
    
    return {
      action,
      targetAsset,
      confidence: confidence.toFixed(1),
      reasoning,
      currentGap: lastDiff.toFixed(2),
      targetGap: targetPrice.toFixed(2),
      expectedMove: expectedMove.toFixed(2),
      riskLevel,
      volatility: volatility.toFixed(2),
      patterns: patterns.map(p => p.type),
      timeHorizon: interval === '1m' || interval === '5m' ? 'Very Short (Minutes)' : 
                   interval === '15m' || interval === '30m' ? 'Short (Hours)' :
                   interval === '1h' || interval === '2h' || interval === '4h' ? 'Medium (Hours-Days)' : 'Long (Days-Weeks)'
    };
  };

  const analyzeTradingSignal = (chartData, asset1Info, asset2Info) => {
    if (chartData.length < 2) return null;
    
    const lastDiff = chartData[chartData.length - 1].diff;
    
    let signal = {
      action: '',
      asset: '',
      reason: '',
      strength: 0,
      diff: lastDiff
    };
    
    if (lastDiff > 0.5) {
      signal.action = 'LONG';
      signal.asset = asset2Info.symbol;
      signal.reason = `${asset2Info.symbol} is outperforming ${asset1Info.symbol} by ${lastDiff.toFixed(2)}%`;
      signal.strength = Math.min(Math.abs(lastDiff) / 2 * 100, 100);
    } else if (lastDiff < -0.5) {
      signal.action = 'LONG';
      signal.asset = asset1Info.symbol;
      signal.reason = `${asset1Info.symbol} is outperforming ${asset2Info.symbol} by ${Math.abs(lastDiff).toFixed(2)}%`;
      signal.strength = Math.min(Math.abs(lastDiff) / 2 * 100, 100);
    } else {
      signal.action = 'NEUTRAL';
      signal.asset = 'BOTH';
      signal.reason = `Small gap between ${asset1Info.symbol} and ${asset2Info.symbol} (${Math.abs(lastDiff).toFixed(2)}%)`;
      signal.strength = 0;
    }
    
    return signal;
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    const asset1Info = getAssetInfo(asset1);
    const asset2Info = getAssetInfo(asset2);

    try {
      const { interval: fetchInterval, limit } = getTimeframeDetails(timeframe, interval);
      
      const url1 = `https://api.binance.com/api/v3/klines?symbol=${asset1}&interval=${fetchInterval}&limit=${limit}`;
      const url2 = `https://api.binance.com/api/v3/klines?symbol=${asset2}&interval=${fetchInterval}&limit=${limit}`;
      
      const [response1, response2] = await Promise.all([
        fetch(url1),
        fetch(url2)
      ]);

      if (!response1.ok || !response2.ok) {
        throw new Error('Binance API request failed');
      }

      const data1 = await response1.json();
      const data2 = await response2.json();

      if (!data1.length || !data2.length) {
        throw new Error('No data received');
      }

      const chartData = [];
      const minLength = Math.min(data1.length, data2.length);
      
      const currentPrice1 = parseFloat(data1[data1.length - 1][4]);
      const currentPrice2 = parseFloat(data2[data2.length - 1][4]);
      
      const prevPrice1 = data1.length > 1 ? parseFloat(data1[data1.length - 2][4]) : parseFloat(data1[0][4]);
      const prevPrice2 = data2.length > 1 ? parseFloat(data2[data2.length - 2][4]) : parseFloat(data2[0][4]);
      
      setPriceInfo({
        asset1: {
          current: currentPrice1,
          previous: prevPrice1,
          change: ((currentPrice1 - prevPrice1) / prevPrice1) * 100
        },
        asset2: {
          current: currentPrice2,
          previous: prevPrice2,
          change: ((currentPrice2 - prevPrice2) / prevPrice2) * 100
        }
      });
      
      const startPrice1 = parseFloat(data1[0][4]);
      const startPrice2 = parseFloat(data2[0][4]);

      for (let i = 0; i < minLength; i++) {
        const currentClose1 = parseFloat(data1[i][4]);
        const currentClose2 = parseFloat(data2[i][4]);
        
        const timestamp = data1[i][0];
        const date = new Date(timestamp);
        
        const changeFromStart1 = ((currentClose1 - startPrice1) / startPrice1) * 100;
        const changeFromStart2 = ((currentClose2 - startPrice2) / startPrice2) * 100;
        const diff = changeFromStart2 - changeFromStart1;
        
        const dateFormat = limit > 90 
          ? { month: 'short', day: 'numeric' }
          : fetchInterval.includes('m') || fetchInterval.includes('h')
          ? { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' }
          : { month: 'short', day: 'numeric' };
        
        chartData.push({
          date: date.toLocaleDateString('en-US', dateFormat),
          timestamp: timestamp,
          asset1Daily: parseFloat(changeFromStart1.toFixed(2)),
          asset2Daily: parseFloat(changeFromStart2.toFixed(2)),
          diff: parseFloat(diff.toFixed(2))
        });
      }

      setData(chartData);
      setTradingSignal(analyzeTradingSignal(chartData, asset1Info, asset2Info));
      
      // Run Advanced Analysis
      const patterns = detectPatterns(chartData);
      const backtest = runBacktest(chartData);
      const prediction = generatePrediction(chartData, patterns, backtest, asset1Info, asset2Info);
      
      setAlgoAnalysis({
        patterns,
        prediction
      });
      setBacktestResults(backtest);
      
    } catch (err) {
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, interval, asset1, asset2]);
  
  const asset1Info = getAssetInfo(asset1);
  const asset2Info = getAssetInfo(asset2);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'white',
          padding: '14px',
          border: '1px solid #ccc',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <p style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '10px', color: '#333' }}>
            {payload[0].payload.date}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: asset1Info.color }}></div>
              <span style={{ fontSize: '15px', color: '#555' }}>{asset1Info.symbol}: {payload[0].value}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: asset2Info.color }}></div>
              <span style={{ fontSize: '15px', color: '#555' }}>{asset2Info.symbol}: {payload[1].value}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const GapTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'white',
          padding: '14px',
          border: '1px solid #ccc',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <p style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '10px', color: '#333' }}>
            {payload[0].payload.date}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
            <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>Gap: {payload[0].value}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const currentStats = data.length > 0 ? data[data.length - 1] : { asset1Daily: 0, asset2Daily: 0, diff: 0 };
  const avgAsset1 = data.length > 0 ? (data.reduce((sum, d) => sum + d.asset1Daily, 0) / data.length).toFixed(2) : 0;
  const avgAsset2 = data.length > 0 ? (data.reduce((sum, d) => sum + d.asset2Daily, 0) / data.length).toFixed(2) : 0;
  const avgDiff = data.length > 0 ? (data.reduce((sum, d) => sum + d.diff, 0) / data.length).toFixed(2) : 0;

  return (
    <div style={{ 
      width: '100%', 
      minHeight: '100vh', 
      background: 'linear-gradient(to bottom right, #1f2937, #111827, #1f2937)',
      padding: '16px'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{
          backgroundColor: '#1f2937',
          borderRadius: '12px 12px 0 0',
          border: '1px solid #374151',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>
              AI-Powered Crypto Analysis
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>Algorithmic Trading with ML Backtesting</p>
              <span style={{
                padding: '4px 8px',
                backgroundColor: '#10b981',
                color: '#d1fae5',
                fontSize: '12px',
                fontWeight: 'bold',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Brain size={12} />
                AI ACTIVE
              </span>
            </div>
          </div>
          <button onClick={loadData} disabled={loading} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: loading ? '#4b5563' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <RefreshCw size={16} />
            <span>Refresh & Reanalyze</span>
          </button>
        </div>

        {/* AI PREDICTION BOX */}
        {algoAnalysis && algoAnalysis.prediction && (
          <div style={{
            backgroundColor: '#1f2937',
            borderLeft: '1px solid #374151',
            borderRight: '1px solid #374151',
            padding: '24px'
          }}>
            <div style={{
              borderRadius: '12px',
              padding: '24px',
              background: algoAnalysis.prediction.action === 'LONG' 
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 78, 59, 0.3) 100%)'
                : algoAnalysis.prediction.action === 'SHORT'
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(127, 29, 29, 0.3) 100%)'
                : 'linear-gradient(135deg, rgba(107, 114, 128, 0.2) 0%, rgba(55, 65, 81, 0.3) 100%)',
              border: algoAnalysis.prediction.action === 'LONG' 
                ? '2px solid rgba(16, 185, 129, 0.5)'
                : algoAnalysis.prediction.action === 'SHORT'
                ? '2px solid rgba(239, 68, 68, 0.5)'
                : '2px solid rgba(107, 114, 128, 0.5)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <Brain size={40} color={
                      algoAnalysis.prediction.action === 'LONG' ? '#34d399' : 
                      algoAnalysis.prediction.action === 'SHORT' ? '#f87171' : '#9ca3af'
                    } />
                    <div>
                      <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'white' }}>
                        {algoAnalysis.prediction.action === 'LONG' 
                          ? `LONG ${algoAnalysis.prediction.targetAsset}` 
                          : algoAnalysis.prediction.action === 'SHORT'
                          ? `SHORT ${algoAnalysis.prediction.targetAsset}`
                          : algoAnalysis.prediction.action}
                      </div>
                      <div style={{ fontSize: '16px', color: '#d1d5db', marginTop: '4px' }}>
                        AI Confidence: {algoAnalysis.prediction.confidence}%
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ 
                    marginBottom: '20px',
                    padding: '16px',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    <div style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '8px', fontWeight: 'bold' }}>
                      📊 ANALYSIS
                    </div>
                    <p style={{ color: '#e5e7eb', fontSize: '16px', lineHeight: '1.6', marginBottom: '0' }}>
                      {algoAnalysis.prediction.reasoning}
                    </p>
                  </div>

                  <div style={{ 
                    marginBottom: '20px',
                    padding: '16px',
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    borderRadius: '8px',
                    border: '2px solid rgba(34, 197, 94, 0.3)'
                  }}>
                    <div style={{ fontSize: '14px', color: '#34d399', marginBottom: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>💡</span>
                      TRADING STRATEGY
                    </div>
                    <p style={{ color: '#e5e7eb', fontSize: '16px', lineHeight: '1.7', marginBottom: '16px' }}>
                      {algoAnalysis.prediction.strategy}
                    </p>
                    
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <div style={{ 
                        padding: '12px',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        borderRadius: '6px',
                        borderLeft: '3px solid #3b82f6'
                      }}>
                        <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '4px' }}>Entry Point</div>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>{algoAnalysis.prediction.entryPrice}</div>
                      </div>
                      
                      <div style={{ 
                        padding: '12px',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        borderRadius: '6px',
                        borderLeft: '3px solid #ef4444'
                      }}>
                        <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '4px' }}>Stop Loss</div>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#f87171' }}>{algoAnalysis.prediction.stopLoss}</div>
                      </div>
                      
                      <div style={{ 
                        padding: '12px',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        borderRadius: '6px',
                        borderLeft: '3px solid #22c55e'
                      }}>
                        <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '4px' }}>Take Profit</div>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#34d399' }}>{algoAnalysis.prediction.takeProfit}</div>
                      </div>
                      
                      <div style={{ 
                        padding: '12px',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        borderRadius: '6px',
                        borderLeft: '3px solid #f59e0b'
                      }}>
                        <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '4px' }}>Position Size</div>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#fbbf24' }}>{algoAnalysis.prediction.positionSize}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '4px' }}>Current Gap</div>
                      <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#fff' }}>{algoAnalysis.prediction.currentGap}%</div>
                    </div>
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '4px' }}>Target Gap</div>
                      <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#34d399' }}>{algoAnalysis.prediction.targetGap}%</div>
                    </div>
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '4px' }}>Expected Move</div>
                      <div style={{ fontSize: '22px', fontWeight: 'bold', color: parseFloat(algoAnalysis.prediction.expectedMove) >= 0 ? '#34d399' : '#f87171' }}>
                        {parseFloat(algoAnalysis.prediction.expectedMove) >= 0 ? '+' : ''}{algoAnalysis.prediction.expectedMove}%
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '4px' }}>Risk Level</div>
                      <div style={{ 
                        fontSize: '22px', 
                        fontWeight: 'bold', 
                        color: algoAnalysis.prediction.riskLevel === 'HIGH' ? '#f87171' : algoAnalysis.prediction.riskLevel === 'MEDIUM' ? '#fbbf24' : '#34d399' 
                      }}>
                        {algoAnalysis.prediction.riskLevel}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '8px' }}>Detected Patterns:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {algoAnalysis.prediction.patterns.map((pattern, idx) => (
                        <span key={idx} style={{
                          padding: '6px 14px',
                          backgroundColor: 'rgba(16, 185, 129, 0.2)',
                          color: '#6ee7b7',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          borderRadius: '12px',
                          border: '1px solid rgba(16, 185, 129, 0.3)'
                        }}>
                          {pattern.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', fontSize: '14px', color: '#9ca3af' }}>
                    ⏱️ Time Horizon: {algoAnalysis.prediction.timeHorizon}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BACKTEST RESULTS */}
        {backtestResults && (
          <div style={{
            backgroundColor: '#1f2937',
            borderLeft: '1px solid #374151',
            borderRight: '1px solid #374151',
            padding: '24px'
          }}>
            <div style={{
              borderRadius: '12px',
              padding: '20px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <CheckCircle size={24} color="#60a5fa" />
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>Backtest Performance</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Win Rate</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: parseFloat(backtestResults.winRate) >= 60 ? '#34d399' : parseFloat(backtestResults.winRate) >= 50 ? '#fbbf24' : '#f87171' }}>
                    {backtestResults.winRate}%
                  </div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Total Trades</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>{backtestResults.totalTrades}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Wins / Losses</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>{backtestResults.wins} / {backtestResults.losses}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Profit Factor</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: parseFloat(backtestResults.profitFactor) >= 1.5 ? '#34d399' : parseFloat(backtestResults.profitFactor) >= 1 ? '#fbbf24' : '#f87171' }}>
                    {backtestResults.profitFactor}
                  </div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Avg Win</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#34d399' }}>+{backtestResults.avgWin}%</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Avg Loss</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f87171' }}>-{backtestResults.avgLoss}%</div>
                </div>
              </div>

              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', color: '#d1d5db' }}>
                  📊 Strategy: Mean Reversion with 1.2σ threshold | Tested on {backtestResults.totalTrades} historical signals
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{
          backgroundColor: '#1f2937',
          borderLeft: '1px solid #374151',
          borderRight: '1px solid #374151',
          padding: '24px'
        }}>
          {error && (
            <div style={{
              marginBottom: '16px',
              backgroundColor: 'rgba(127, 29, 29, 0.5)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <span style={{ color: '#fca5a5', fontWeight: 'bold' }}>⚠️ API Error</span>
              <p style={{ color: '#fecaca', fontSize: '14px' }}>{error}</p>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                Asset 1
              </label>
              <select value={asset1} onChange={(e) => setAsset1(e.target.value)} style={{
                width: '100%',
                padding: '8px 16px',
                backgroundColor: '#374151',
                color: 'white',
                border: '1px solid #4b5563',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}>
                {CRYPTO_OPTIONS.map(crypto => (
                  <option key={crypto.id} value={crypto.id}>{crypto.symbol} - {crypto.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                Asset 2
              </label>
              <select value={asset2} onChange={(e) => setAsset2(e.target.value)} style={{
                width: '100%',
                padding: '8px 16px',
                backgroundColor: '#374151',
                color: 'white',
                border: '1px solid #4b5563',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}>
                {CRYPTO_OPTIONS.map(crypto => (
                  <option key={crypto.id} value={crypto.id}>{crypto.symbol} - {crypto.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                Interval
              </label>
              <select value={interval} onChange={(e) => setInterval(e.target.value)} style={{
                width: '100%',
                padding: '8px 16px',
                backgroundColor: '#374151',
                color: 'white',
                border: '1px solid #4b5563',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}>
                {INTERVAL_OPTIONS.map(int => (
                  <option key={int.value} value={int.value}>{int.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {tradingSignal && (
          <div style={{
            backgroundColor: '#1f2937',
            borderLeft: '1px solid #374151',
            borderRight: '1px solid #374151',
            padding: '24px'
          }}>
            <div style={{
              borderRadius: '8px',
              padding: '16px',
              border: tradingSignal.action === 'LONG' ? '2px solid rgba(16, 185, 129, 0.5)' : '2px solid rgba(75, 85, 99, 0.5)',
              backgroundColor: tradingSignal.action === 'LONG' ? 'rgba(6, 78, 59, 0.3)' : 'rgba(55, 65, 81, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {tradingSignal.action === 'LONG' ? <ArrowUpCircle size={32} color="#34d399" /> : <TrendingUp size={32} color="#9ca3af" />}
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>
                      {tradingSignal.action === 'LONG' ? `LONG ${tradingSignal.asset}` : 'NEUTRAL POSITION'}
                    </div>
                    <div style={{ fontSize: '14px', color: '#d1d5db', marginTop: '4px' }}>{tradingSignal.reason}</div>
                  </div>
                </div>
                {tradingSignal.strength > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#34d399' }}>
                      {tradingSignal.strength.toFixed(0)}%
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>Signal Strength</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px',
          padding: '16px 24px',
          backgroundColor: '#1f2937',
          borderLeft: '1px solid #374151',
          borderRight: '1px solid #374151'
        }}>
          <div style={{
            background: 'linear-gradient(to bottom right, rgba(249, 115, 22, 0.2), rgba(249, 115, 22, 0.1))',
            border: '1px solid rgba(249, 115, 22, 0.3)',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#fb923c', fontSize: '12px', fontWeight: 'bold' }}>{asset1Info.symbol} CHANGE</span>
              {currentStats.asset1Daily >= 0 ? <TrendingUp size={16} color="#34d399" /> : <TrendingDown size={16} color="#f87171" />}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: currentStats.asset1Daily >= 0 ? '#34d399' : '#f87171' }}>
              {currentStats.asset1Daily >= 0 ? '+' : ''}{currentStats.asset1Daily}%
            </div>
            {priceInfo.asset1 && (
              <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px' }}>
                <div>Current: ${priceInfo.asset1.current.toLocaleString()}</div>
                <div>Previous: ${priceInfo.asset1.previous.toLocaleString()}</div>
              </div>
            )}
            <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>Avg: {avgAsset1}%</div>
          </div>
          
          <div style={{
            background: 'linear-gradient(to bottom right, rgba(168, 85, 247, 0.2), rgba(168, 85, 247, 0.1))',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#c084fc', fontSize: '12px', fontWeight: 'bold' }}>{asset2Info.symbol} CHANGE</span>
              {currentStats.asset2Daily >= 0 ? <TrendingUp size={16} color="#34d399" /> : <TrendingDown size={16} color="#f87171" />}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: currentStats.asset2Daily >= 0 ? '#34d399' : '#f87171' }}>
              {currentStats.asset2Daily >= 0 ? '+' : ''}{currentStats.asset2Daily}%
            </div>
            {priceInfo.asset2 && (
              <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px' }}>
                <div>Current: ${priceInfo.asset2.current.toLocaleString()}</div>
                <div>Previous: ${priceInfo.asset2.previous.toLocaleString()}</div>
              </div>
            )}
            <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>Avg: {avgAsset2}%</div>
          </div>
          
          <div style={{
            background: 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#60a5fa', fontSize: '12px', fontWeight: 'bold' }}>PRICE GAP</span>
              {currentStats.diff >= 0 ? <TrendingUp size={16} color="#34d399" /> : <TrendingDown size={16} color="#f87171" />}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: currentStats.diff >= 0 ? '#34d399' : '#f87171' }}>
              {currentStats.diff >= 0 ? '+' : ''}{currentStats.diff}%
            </div>
            <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px' }}>
              {asset2Info.symbol} {currentStats.asset2Daily >= 0 ? '+' : ''}{currentStats.asset2Daily}% vs {asset1Info.symbol} {currentStats.asset1Daily >= 0 ? '+' : ''}{currentStats.asset1Daily}%
            </div>
            <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>Avg Gap: {avgDiff}%</div>
          </div>
        </div>

        <div style={{
          backgroundColor: '#1f2937',
          borderLeft: '1px solid #374151',
          borderRight: '1px solid #374151',
          padding: '12px 24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '500', marginRight: '8px' }}>Timeframe:</span>
            {['1D', '7D', '1M', '3M', '6M', '1Y', 'YTD'].map((tf) => (
              <button key={tf} onClick={() => setTimeframe(tf)} style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: '500',
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: timeframe === tf ? '#2563eb' : '#374151',
                color: timeframe === tf ? 'white' : '#d1d5db',
                boxShadow: timeframe === tf ? '0 4px 6px rgba(0,0,0,0.1)' : 'none'
              }}>
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div style={{
          backgroundColor: '#1f2937',
          borderLeft: '1px solid #374151',
          borderRight: '1px solid #374151',
          padding: '24px'
        }}>
          <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
            Asset Performance Comparison
          </h2>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '500px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '22px', color: '#d1d5db', marginBottom: '8px' }}>Loading chart...</div>
                <div style={{ fontSize: '16px', color: '#6b7280' }}>Please wait</div>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={500}>
              <LineChart data={data}>
                <defs>
                  <linearGradient id="asset1Gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={asset1Info.color} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={asset1Info.color} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="asset2Gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={asset2Info.color} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={asset2Info.color} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 13, fill: '#9ca3af' }} angle={-45} textAnchor="end" height={80} stroke="#4b5563" />
                <YAxis tick={{ fontSize: 13, fill: '#9ca3af' }} label={{ value: '% Change', angle: -90, position: 'insideLeft', fill: '#9ca3af', style: { fontSize: '14px' } }} stroke="#4b5563" />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '14px' }} iconType="line" />
                <Line type="monotone" dataKey="asset1Daily" stroke={asset1Info.color} strokeWidth={3} name={`${asset1Info.name}`} dot={false} fill="url(#asset1Gradient)" />
                <Line type="monotone" dataKey="asset2Daily" stroke={asset2Info.color} strokeWidth={3} name={`${asset2Info.name}`} dot={false} fill="url(#asset2Gradient)" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{
          backgroundColor: '#1f2937',
          borderLeft: '1px solid #374151',
          borderRight: '1px solid #374151',
          borderBottom: '1px solid #374151',
          borderRadius: '0 0 12px 12px',
          padding: '24px'
        }}>
          <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
            Price Gap Analysis
          </h2>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '500px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '22px', color: '#d1d5db', marginBottom: '8px' }}>Loading chart...</div>
                <div style={{ fontSize: '16px', color: '#6b7280' }}>Please wait</div>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={500}>
              <LineChart data={data}>
                <defs>
                  <linearGradient id="gapGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 13, fill: '#9ca3af' }} angle={-45} textAnchor="end" height={80} stroke="#4b5563" />
                <YAxis tick={{ fontSize: 13, fill: '#9ca3af' }} label={{ value: 'Gap (%)', angle: -90, position: 'insideLeft', fill: '#9ca3af', style: { fontSize: '14px' } }} stroke="#4b5563" />
                <Tooltip content={<GapTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '14px' }} iconType="line" />
                <Line type="monotone" dataKey="diff" stroke="#10b981" strokeWidth={3} name={`Gap (${asset2Info.symbol} - ${asset1Info.symbol})`} dot={false} fill="url(#gapGradient)" />
              </LineChart>
            </ResponsiveContainer>
          )}
          <div style={{ marginTop: '16px', padding: '14px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <p style={{ color: '#9ca3af', fontSize: '15px' }}>
              <span style={{ color: '#d1d5db', fontWeight: '500' }}>🤖 AI Strategy:</span> Machine learning pattern recognition with mean reversion backtesting
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
