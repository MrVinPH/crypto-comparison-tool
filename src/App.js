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
];

const INTERVAL_OPTIONS = [
  { value: '1m', label: '1 Minute' },
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' },
];

function App() {
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
  const [manualThresholds, setManualThresholds] = useState({
    minWinRate: 65,
    minProfitFactor: 1.5,
    minGap: 1.0
  });

  const getAssetInfo = (assetId) => CRYPTO_OPTIONS.find(a => a.id === assetId) || CRYPTO_OPTIONS[0];

  const getTimeframeDetails = (tf, selectedInterval) => {
    switch(tf) {
      case '1D': return { interval: selectedInterval, limit: 24 };
      case '7D': return { interval: selectedInterval, limit: selectedInterval === '1d' ? 7 : 168 };
      case '1M': return { interval: selectedInterval, limit: selectedInterval === '1d' ? 30 : 720 };
      case '3M': return { interval: '1d', limit: 90 };
      default: return { interval: selectedInterval, limit: 7 };
    }
  };

  const detectMarketRegime = (chartData, priceInfo) => {
    if (!chartData.length || !priceInfo.asset1 || !priceInfo.asset2) return null;
    
    const recentData = chartData.slice(-10);
    const priceChanges1 = recentData.map(d => d.asset1Daily);
    const priceChanges2 = recentData.map(d => d.asset2Daily);
    
    const avgChange1 = priceChanges1.reduce((sum, val) => sum + val, 0) / priceChanges1.length;
    const avgChange2 = priceChanges2.reduce((sum, val) => sum + val, 0) / priceChanges2.length;
    
    let marketTrend;
    const combinedAvg = (avgChange1 + avgChange2) / 2;
    
    if (combinedAvg > 1) {
      marketTrend = 'BULL';
    } else if (combinedAvg < -1) {
      marketTrend = 'BEAR';
    } else {
      marketTrend = 'SIDEWAYS';
    }
    
    let regimeLeader;
    const recentGaps = recentData.map(d => d.diff);
    const gapTrend = recentGaps[recentGaps.length - 1] - recentGaps[0];
    
    if (marketTrend === 'BULL') {
      regimeLeader = gapTrend > 0 ? 'ETH' : 'BTC';
    } else if (marketTrend === 'BEAR') {
      regimeLeader = gapTrend < 0 ? 'BTC' : 'ETH';
    } else {
      regimeLeader = 'NEUTRAL';
    }
    
    const calculateRSI = (data) => {
      if (data.length < 14) return 50;
      const changes = [];
      for (let i = 1; i < data.length; i++) {
        changes.push(data[i] - data[i-1]);
      }
      const gains = changes.map(c => c > 0 ? c : 0);
      const losses = changes.map(c => c < 0 ? Math.abs(c) : 0);
      const avgGain = gains.slice(-14).reduce((sum, val) => sum + val, 0) / 14;
      const avgLoss = losses.slice(-14).reduce((sum, val) => sum + val, 0) / 14;
      if (avgLoss === 0) return 100;
      const rs = avgGain / avgLoss;
      return 100 - (100 / (1 + rs));
    };
    
    const asset1Prices = chartData.map(d => d.asset1Daily);
    const asset2Prices = chartData.map(d => d.asset2Daily);
    const rsi1 = calculateRSI(asset1Prices);
    const rsi2 = calculateRSI(asset2Prices);
    
    let asset1Condition, asset2Condition;
    
    if (rsi1 < 30) asset1Condition = 'OVERSOLD';
    else if (rsi1 > 70) asset1Condition = 'OVERBOUGHT';
    else asset1Condition = 'NEUTRAL';
    
    if (rsi2 < 30) asset2Condition = 'OVERSOLD';
    else if (rsi2 > 70) asset2Condition = 'OVERBOUGHT';
    else asset2Condition = 'NEUTRAL';
    
    const allGaps = chartData.map(d => d.diff);
    const sortedGaps = [...allGaps].sort((a, b) => a - b);
    const q1 = sortedGaps[Math.floor(sortedGaps.length * 0.25)];
    const q3 = sortedGaps[Math.floor(sortedGaps.length * 0.75)];
    const currentGap = priceInfo.asset2.change - priceInfo.asset1.change;
    
    let supportResistance;
    if (currentGap <= q1) {
      supportResistance = 'AT_SUPPORT';
    } else if (currentGap >= q3) {
      supportResistance = 'AT_RESISTANCE';
    } else {
      supportResistance = 'MIDDLE_RANGE';
    }
    
    const recentVol = recentData.slice(-5).map(d => Math.abs(d.diff));
    const historicalVol = chartData.slice(0, -5).map(d => Math.abs(d.diff));
    const avgRecentVol = recentVol.reduce((sum, val) => sum + val, 0) / recentVol.length;
    const avgHistoricalVol = historicalVol.reduce((sum, val) => sum + val, 0) / historicalVol.length;
    
    let volatilityRegime;
    if (avgRecentVol > avgHistoricalVol * 1.5) {
      volatilityRegime = 'HIGH';
    } else if (avgRecentVol < avgHistoricalVol * 0.7) {
      volatilityRegime = 'LOW';
    } else {
      volatilityRegime = 'NORMAL';
    }
    
    return {
      marketTrend,
      regimeLeader,
      asset1RSI: rsi1.toFixed(1),
      asset2RSI: rsi2.toFixed(1),
      asset1Condition,
      asset2Condition,
      supportResistance,
      volatilityRegime,
      avgChange1: avgChange1.toFixed(2),
      avgChange2: avgChange2.toFixed(2)
    };
  };

  const detectPatterns = (chartData) => {
    if (chartData.length < 10) return [];
    
    const patterns = [];
    const diffs = chartData.map(d => d.diff);
    const recentDiffs = diffs.slice(-5);
    const trend = recentDiffs.reduce((sum, val) => sum + val, 0) / recentDiffs.length;
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

  const runBacktest = (chartData) => {
    if (chartData.length < 20) return null;
    
    let wins = 0;
    let losses = 0;
    let totalProfit = 0;
    const lookbackPeriod = 10;
    
    for (let i = lookbackPeriod; i < chartData.length - 1; i++) {
      const historicalData = chartData.slice(i - lookbackPeriod, i);
      const currentDiff = chartData[i].diff;
      const nextDiff = chartData[i + 1].diff;
      const diffs = historicalData.map(d => d.diff);
      const mean = diffs.reduce((sum, val) => sum + val, 0) / diffs.length;
      const stdDev = Math.sqrt(diffs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / diffs.length);
      let entryPrice = currentDiff;
      let exitPrice = nextDiff;
      
      if (currentDiff > mean + 1.2 * stdDev) {
        const profitLoss = entryPrice - exitPrice;
        totalProfit += profitLoss;
        if (profitLoss > 0) wins++;
        else losses++;
      } else if (currentDiff < mean - 1.2 * stdDev) {
        const profitLoss = exitPrice - entryPrice;
        totalProfit += profitLoss;
        if (profitLoss > 0) wins++;
        else losses++;
      }
    }
    
    const totalTrades = wins + losses;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const avgWin = wins > 0 ? totalProfit / wins : 0;
    const avgLoss = losses > 0 ? Math.abs(totalProfit / losses) : 0;
    const profitFactor = avgLoss > 0 ? (avgWin * wins) / (avgLoss * losses) : wins > 0 ? 999 : 0;
    
    return {
      totalTrades,
      wins,
      losses,
      winRate: winRate.toFixed(1),
      totalProfit: totalProfit.toFixed(2),
      avgWin: avgWin.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
      profitFactor: profitFactor.toFixed(2)
    };
  };

  const generatePrediction = (chartData, patterns, backtestResults, asset1Info, asset2Info, marketRegime) => {
    if (!chartData.length || !patterns.length || !backtestResults || !marketRegime) return null;
    
    const lastDiff = priceInfo.asset1 && priceInfo.asset2 ? (priceInfo.asset2.change - priceInfo.asset1.change) : 0;
    
    if (!priceInfo.asset1 || !priceInfo.asset2) return null;
    
    const diffs = chartData.map(d => d.diff);
    const mean = diffs.reduce((sum, val) => sum + val, 0) / diffs.length;
    const stdDev = Math.sqrt(diffs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / diffs.length);
    
    const avgWin = parseFloat(backtestResults.avgWin);
    const avgLoss = parseFloat(backtestResults.avgLoss);
    const winRate = parseFloat(backtestResults.winRate) / 100;
    const profitFactor = parseFloat(backtestResults.profitFactor);
    
    const feePerTrade = 0.15;
    const expectedValue = (winRate * avgWin) - ((1 - winRate) * avgLoss) - feePerTrade;
    
    const minWinRate = manualThresholds.minWinRate;
    const minProfitFactor = manualThresholds.minProfitFactor;
    const minGap = manualThresholds.minGap;
    
    const meetsWinRate = parseFloat(backtestResults.winRate) >= minWinRate;
    const meetsProfitFactor = profitFactor >= minProfitFactor;
    const meetsGap = Math.abs(lastDiff) >= minGap;
    
    let regimeAdjustment = 0;
    let regimeWarnings = [];
    
    if (marketRegime.marketTrend === 'BULL') {
      if (lastDiff > 0) {
        regimeAdjustment -= 10;
        regimeWarnings.push('Bull market: ETH tends to outperform, current gap may persist');
      } else {
        regimeAdjustment += 10;
        regimeWarnings.push('Bull market: BTC ahead is unusual, strong mean reversion expected');
      }
    } else if (marketRegime.marketTrend === 'BEAR') {
      if (lastDiff < 0) {
        regimeAdjustment -= 10;
        regimeWarnings.push('Bear market: BTC tends to hold better, current gap may persist');
      } else {
        regimeAdjustment += 10;
        regimeWarnings.push('Bear market: ETH ahead is unusual, strong mean reversion expected');
      }
    }
    
    if (marketRegime.asset1Condition === 'OVERSOLD') {
      regimeAdjustment += 5;
      regimeWarnings.push(`${asset1Info.symbol} is oversold (RSI: ${marketRegime.asset1RSI}), bounce likely`);
    } else if (marketRegime.asset1Condition === 'OVERBOUGHT') {
      regimeAdjustment -= 5;
      regimeWarnings.push(`${asset1Info.symbol} is overbought (RSI: ${marketRegime.asset1RSI}), pullback likely`);
    }
    
    if (marketRegime.asset2Condition === 'OVERSOLD') {
      regimeAdjustment -= 5;
      regimeWarnings.push(`${asset2Info.symbol} is oversold (RSI: ${marketRegime.asset2RSI}), bounce likely`);
    } else if (marketRegime.asset2Condition === 'OVERBOUGHT') {
      regimeAdjustment += 5;
      regimeWarnings.push(`${asset2Info.symbol} is overbought (RSI: ${marketRegime.asset2RSI}), pullback likely`);
    }
    
    if (marketRegime.supportResistance === 'AT_SUPPORT') {
      if (lastDiff < 0) {
        regimeAdjustment += 10;
        regimeWarnings.push('Gap at historical support level, strong bounce expected');
      }
    } else if (marketRegime.supportResistance === 'AT_RESISTANCE') {
      if (lastDiff > 0) {
        regimeAdjustment += 10;
        regimeWarnings.push('Gap at historical resistance level, reversal likely');
      }
    }
    
    if (marketRegime.volatilityRegime === 'HIGH') {
      regimeAdjustment -= 15;
      regimeWarnings.push('High volatility environment, mean reversion less reliable');
    } else if (marketRegime.volatilityRegime === 'LOW') {
      regimeAdjustment += 10;
      regimeWarnings.push('Low volatility environment, mean reversion more reliable');
    }
    
    let action, targetAsset, perpetualAction, confidence, reasoning, strategy, pairsTrade;
    
    const meetsAnyCriteria = meetsWinRate || meetsProfitFactor || meetsGap;
    
    if (!meetsAnyCriteria) {
      action = 'SKIP';
      targetAsset = 'NONE';
      perpetualAction = 'NO TRADE';
      
      let reasons = [];
      if (!meetsWinRate) reasons.push(`Win rate ${backtestResults.winRate}% < ${minWinRate}%`);
      if (!meetsProfitFactor) reasons.push(`Profit factor ${profitFactor.toFixed(2)} < ${minProfitFactor}`);
      if (!meetsGap) reasons.push(`Gap ${Math.abs(lastDiff).toFixed(2)}% < ${minGap}%`);
      
      reasoning = `No thresholds met: ${reasons.join(', ')}`;
      strategy = `⚠️ SKIP - ${reasoning}`;
      pairsTrade = null;
      confidence = 0;
    } else {
      if (lastDiff > 0) {
        action = 'PAIRS';
        targetAsset = asset1Info.symbol;
        perpetualAction = `PAIRS TRADE`;
        reasoning = `${asset2Info.symbol} ahead by ${lastDiff.toFixed(2)}%. Mean reversion expected.`;
        strategy = `LONG ${asset1Info.symbol} + SHORT ${asset2Info.symbol} (equal $ amounts)`;
        pairsTrade = {
          long: asset1Info.symbol,
          short: asset2Info.symbol,
          currentGap: lastDiff.toFixed(2),
          expectedProfit: (Math.abs(lastDiff - mean) * 0.6).toFixed(2)
        };
        confidence = Math.min(60 + (meetsWinRate ? 15 : 0) + (meetsProfitFactor ? 15 : 0) + (meetsGap ? 10 : 0) + regimeAdjustment, 100);
        confidence = Math.max(confidence, 0);
      } else {
        action = 'PAIRS';
        targetAsset = asset2Info.symbol;
        perpetualAction = `PAIRS TRADE`;
        reasoning = `${asset1Info.symbol} ahead by ${Math.abs(lastDiff).toFixed(2)}%. Mean reversion expected.`;
        strategy = `LONG ${asset2Info.symbol} + SHORT ${asset1Info.symbol} (equal $ amounts)`;
        pairsTrade = {
          long: asset2Info.symbol,
          short: asset1Info.symbol,
          currentGap: lastDiff.toFixed(2),
          expectedProfit: (Math.abs(lastDiff - mean) * 0.6).toFixed(2)
        };
        confidence = Math.min(60 + (meetsWinRate ? 15 : 0) + (meetsProfitFactor ? 15 : 0) + (meetsGap ? 10 : 0) + regimeAdjustment, 100);
        confidence = Math.max(confidence, 0);
      }
    }
    
    const volatility = stdDev;
    const riskLevel = volatility > 2 ? 'HIGH' : volatility > 1 ? 'MEDIUM' : 'LOW';
    
    return {
      action,
      targetAsset,
      perpetualAction,
      pairsTrade,
      confidence: confidence.toFixed(1),
      reasoning,
      strategy,
      currentGap: lastDiff.toFixed(2),
      riskLevel,
      volatility: volatility.toFixed(2),
      patterns: patterns.map(p => p.type),
      regimeAdjustment,
      regimeWarnings
    };
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
      
      const [response1, response2] = await Promise.all([fetch(url1), fetch(url2)]);

      if (!response1.ok || !response2.ok) {
        throw new Error('API request failed');
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
      
      const fetchUrl1_24h = `https://api.binance.com/api/v3/klines?symbol=${asset1}&interval=1d&limit=2`;
      const fetchUrl2_24h = `https://api.binance.com/api/v3/klines?symbol=${asset2}&interval=1d&limit=2`;
      
      const [response1_24h, response2_24h] = await Promise.all([fetch(fetchUrl1_24h), fetch(fetchUrl2_24h)]);
      
      const data1_24h = await response1_24h.json();
      const data2_24h = await response2_24h.json();
      
      const prevDayClose1 = data1_24h.length >= 2 ? parseFloat(data1_24h[data1_24h.length - 2][4]) : currentPrice1;
      const prevDayClose2 = data2_24h.length >= 2 ? parseFloat(data2_24h[data2_24h.length - 2][4]) : currentPrice2;
      
      const change24h1 = ((currentPrice1 - prevDayClose1) / prevDayClose1) * 100;
      const change24h2 = ((currentPrice2 - prevDayClose2) / prevDayClose2) * 100;
      
      setPriceInfo({
        asset1: { current: currentPrice1, previous: prevDayClose1, change: change24h1 },
        asset2: { current: currentPrice2, previous: prevDayClose2, change: change24h2 }
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
        
        chartData.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          timestamp: timestamp,
          asset1Daily: parseFloat(changeFromStart1.toFixed(2)),
          asset2Daily: parseFloat(changeFromStart2.toFixed(2)),
          diff: parseFloat(diff.toFixed(2))
        });
      }

      setData(chartData);
      
      const marketRegime = detectMarketRegime(chartData, {
        asset1: { current: currentPrice1, previous: prevDayClose1, change: change24h1 },
        asset2: { current: currentPrice2, previous: prevDayClose2, change: change24h2 }
      });
      
      const patterns = detectPatterns(chartData);
      const backtest = runBacktest(chartData);
      const prediction = generatePrediction(chartData, patterns, backtest, asset1Info, asset2Info, marketRegime);
      
      setAlgoAnalysis({ patterns, prediction, marketRegime });
      setBacktestResults(backtest);
      
    } catch (err) {
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [timeframe, interval, asset1, asset2]);

  useEffect(() => {
    if (data.length > 0 && backtestResults && priceInfo.asset1 && priceInfo.asset2) {
      const asset1Info = getAssetInfo(asset1);
      const asset2Info = getAssetInfo(asset2);
      
      const marketRegime = detectMarketRegime(data, priceInfo);
      const patterns = detectPatterns(data);
      const prediction = generatePrediction(data, patterns, backtestResults, asset1Info, asset2Info, marketRegime);
      
      setAlgoAnalysis({ patterns, prediction, marketRegime });
    }
  }, [manualThresholds, priceInfo]);
  
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

  const avgAsset1 = data.length > 0 ? (data.reduce((sum, d) => sum + d.asset1Daily, 0) / data.length).toFixed(2) : 0;
  const avgAsset2 = data.length > 0 ? (data.reduce((sum, d) => sum + d.asset2Daily, 0) / data.length).toFixed(2) : 0;
  const avgDiff = data.length > 0 ? (data.reduce((sum, d) => sum + d.diff, 0) / data.length).toFixed(2) : 0;
  const currentGap = priceInfo.asset1 && priceInfo.asset2 ? (priceInfo.asset2.change - priceInfo.asset1.change).toFixed(2) : '0.00';

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'linear-gradient(to bottom right, #1f2937, #111827, #1f2937)', padding: '16px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ backgroundColor: '#1f2937', borderRadius: '12px 12px 0 0', border: '1px solid #374151', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>AI-Powered Crypto Analysis</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>Market Regime & Pairs Trading</p>
              <span style={{ padding: '4px 8px', backgroundColor: '#10b981', color: '#d1fae5', fontSize: '12px', fontWeight: 'bold', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Brain size={12} />
                AI ACTIVE
              </span>
            </div>
          </div>
          <button onClick={loadData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: loading ? '#4b5563' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>

        {algoAnalysis && algoAnalysis.prediction && algoAnalysis.prediction.action !== 'SKIP' && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '24px' }}>
            <div style={{ borderRadius: '12px', padding: '24px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 78, 59, 0.3) 100%)', border: '2px solid rgba(16, 185, 129, 0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Brain size={40} color="#34d399" />
                <div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'white' }}>{algoAnalysis.prediction.perpetualAction}</div>
                  <div style={{ fontSize: '16px', color: '#d1d5db', marginTop: '4px' }}>Confidence: {algoAnalysis.prediction.confidence}%</div>
                </div>
              </div>
              
              <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '8px', fontWeight: 'bold' }}>📊 ANALYSIS</div>
                <p style={{ color: '#e5e7eb', fontSize: '16px', lineHeight: '1.6', marginBottom: '0' }}>{algoAnalysis.prediction.reasoning}</p>
              </div>

              {algoAnalysis.prediction.pairsTrade && (
                <div style={{ padding: '16px', backgroundColor: 'rgba(34, 197, 94, 0.15)', borderRadius: '8px', border: '2px solid rgba(34, 197, 94, 0.4)', marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', color: '#6ee7b7', fontWeight: 'bold', marginBottom: '12px' }}>💡 PAIRS TRADE EXECUTION</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.2)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                      <div style={{ fontSize: '12px', color: '#6ee7b7', marginBottom: '4px' }}>LONG</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#34d399' }}>{algoAnalysis.prediction.pairsTrade.long}</div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                      <div style={{ fontSize: '12px', color: '#fca5a5', marginBottom: '4px' }}>SHORT</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f87171' }}>{algoAnalysis.prediction.pairsTrade.short}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '13px', color: '#d1d5db' }}>Expected Profit: <span style={{ color: '#34d399', fontWeight: 'bold' }}>+{algoAnalysis.prediction.pairsTrade.expectedProfit}%</span></div>
                </div>
              )}

              {algoAnalysis.prediction.regimeWarnings && algoAnalysis.prediction.regimeWarnings.length > 0 && (
                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(59, 130, 246, 0.15)', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                  <div style={{ fontSize: '13px', color: '#60a5fa', fontWeight: 'bold', marginBottom: '8px' }}>🔍 Market Context:</div>
                  {algoAnalysis.prediction.regimeWarnings.map((warning, idx) => (
                    <div key={idx} style={{ fontSize: '12px', color: '#93c5fd', marginBottom: '4px' }}>• {warning}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {algoAnalysis && algoAnalysis.marketRegime && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '24px' }}>
            <div style={{ borderRadius: '12px', padding: '20px', backgroundColor: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <TrendingUp size={24} color="#a78bfa" />
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>Market Regime Analysis</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>Market Trend</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: algoAnalysis.marketRegime.marketTrend === 'BULL' ? '#34d399' : algoAnalysis.marketRegime.marketTrend === 'BEAR' ? '#f87171' : '#fbbf24' }}>{algoAnalysis.marketRegime.marketTrend}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>RSI Indicators</div>
                  <div style={{ fontSize: '14px', color: '#d1d5db', marginTop: '8px' }}>
                    <div>{asset1Info.symbol}: <span style={{ fontWeight: 'bold', color: algoAnalysis.marketRegime.asset1Condition === 'OVERSOLD' ? '#34d399' : algoAnalysis.marketRegime.asset1Condition === 'OVERBOUGHT' ? '#f87171' : '#9ca3af' }}>{algoAnalysis.marketRegime.asset1RSI}</span></div>
                    <div>{asset2Info.symbol}: <span style={{ fontWeight: 'bold', color: algoAnalysis.marketRegime.asset2Condition === 'OVERSOLD' ? '#34d399' : algoAnalysis.marketRegime.asset2Condition === 'OVERBOUGHT' ? '#f87171' : '#9ca3af' }}>{algoAnalysis.marketRegime.asset2RSI}</span></div>
                  </div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>Support/Resistance</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: algoAnalysis.marketRegime.supportResistance === 'AT_SUPPORT' ? '#34d399' : algoAnalysis.marketRegime.supportResistance === 'AT_RESISTANCE' ? '#f87171' : '#fbbf24' }}>{algoAnalysis.marketRegime.supportResistance.replace(/_/g, ' ')}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>Volatility</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: algoAnalysis.marketRegime.volatilityRegime === 'HIGH' ? '#f87171' : algoAnalysis.marketRegime.volatilityRegime === 'LOW' ? '#34d399' : '#fbbf24' }}>{algoAnalysis.marketRegime.volatilityRegime}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {backtestResults && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '24px' }}>
            <div style={{ borderRadius: '12px', padding: '20px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <CheckCircle size={24} color="#60a5fa" />
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>Backtest Performance</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Win Rate</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: parseFloat(backtestResults.winRate) >= 60 ? '#34d399' : '#fbbf24' }}>{backtestResults.winRate}%</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Total Trades</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>{backtestResults.totalTrades}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Profit Factor</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: parseFloat(backtestResults.profitFactor) >= 1.5 ? '#34d399' : '#fbbf24' }}>{backtestResults.profitFactor}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '24px' }}>
          <h3 style={{ color: 'white', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>🎯 Settings</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>Asset 1</label>
              <select value={asset1} onChange={(e) => setAsset1(e.target.value)} style={{ width: '100%', padding: '8px 16px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                {CRYPTO_OPTIONS.map(crypto => <option key={crypto.id} value={crypto.id}>{crypto.symbol}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>Asset 2</label>
              <select value={asset2} onChange={(e) => setAsset2(e.target.value)} style={{ width: '100%', padding: '8px 16px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                {CRYPTO_OPTIONS.map(crypto => <option key={crypto.id} value={crypto.id}>{crypto.symbol}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>Interval</label>
              <select value={interval} onChange={(e) => setInterval(e.target.value)} style={{ width: '100%', padding: '8px 16px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                {INTERVAL_OPTIONS.map(int => <option key={int.value} value={int.value}>{int.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', padding: '16px 24px', backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151' }}>
          <div style={{ background: 'linear-gradient(to bottom right, rgba(249, 115, 22, 0.2), rgba(249, 115, 22, 0.1))', border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#fb923c', fontSize: '12px', fontWeight: 'bold' }}>{asset1Info.symbol} 24H</span>
              {priceInfo.asset1 && priceInfo.asset1.change >= 0 ? <TrendingUp size={16} color="#34d399" /> : <TrendingDown size={16} color="#f87171" />}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: priceInfo.asset1 && priceInfo.asset1.change >= 0 ? '#34d399' : '#f87171' }}>
              {priceInfo.asset1 && (priceInfo.asset1.change >= 0 ? '+' : '')}{priceInfo.asset1?.change.toFixed(2)}%
            </div>
          </div>
          
          <div style={{ background: 'linear-gradient(to bottom right, rgba(168, 85, 247, 0.2), rgba(168, 85, 247, 0.1))', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#c084fc', fontSize: '12px', fontWeight: 'bold' }}>{asset2Info.symbol} 24H</span>
              {priceInfo.asset2 && priceInfo.asset2.change >= 0 ? <TrendingUp size={16} color="#34d399" /> : <TrendingDown size={16} color="#f87171" />}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: priceInfo.asset2 && priceInfo.asset2.change >= 0 ? '#34d399' : '#f87171' }}>
              {priceInfo.asset2 && (priceInfo.asset2.change >= 0 ? '+' : '')}{priceInfo.asset2?.change.toFixed(2)}%
            </div>
          </div>
          
          <div style={{ background: 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#60a5fa', fontSize: '12px', fontWeight: 'bold' }}>GAP</span>
              {parseFloat(currentGap) >= 0 ? <TrendingUp size={16} color="#34d399" /> : <TrendingDown size={16} color="#f87171" />}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: parseFloat(currentGap) >= 0 ? '#34d399' : '#f87171' }}>
              {parseFloat(currentGap) >= 0 ? '+' : ''}{currentGap}%
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '12px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '500', marginRight: '8px' }}>Timeframe:</span>
            {['1D', '7D', '1M', '3M'].map((tf) => (
              <button key={tf} onClick={() => setTimeframe(tf)} style={{ padding: '8px 16px', borderRadius: '8px', fontWeight: '500', fontSize: '14px', border: 'none', cursor: 'pointer', backgroundColor: timeframe === tf ? '#2563eb' : '#374151', color: timeframe === tf ? 'white' : '#d1d5db' }}>
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', borderBottom: '1px solid #374151', borderRadius: '0 0 12px 12px', padding: '24px' }}>
          <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Performance Chart</h2>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '500px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '22px', color: '#d1d5db', marginBottom: '8px' }}>Loading...</div>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={500}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 13, fill: '#9ca3af' }} angle={-45} textAnchor="end" height={80} stroke="#4b5563" />
                <YAxis tick={{ fontSize: 13, fill: '#9ca3af' }} stroke="#4b5563" />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '14px' }} iconType="line" />
                <Line type="monotone" dataKey="asset1Daily" stroke={asset1Info.color} strokeWidth={3} name={asset1Info.name} dot={false} />
                <Line type="monotone" dataKey="asset2Daily" stroke={asset2Info.color} strokeWidth={3} name={asset2Info.name} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
