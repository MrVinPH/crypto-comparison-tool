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
  const [error, setError] = useState(null); // eslint-disable-line no-unused-vars
  const [priceInfo, setPriceInfo] = useState({ asset1: null, asset2: null });
  const [algoAnalysis, setAlgoAnalysis] = useState(null);
  const [backtestResults, setBacktestResults] = useState(null);
  const [mlMetrics, setMlMetrics] = useState(null);
  const [manualThresholds] = useState({
    minWinRate: 65,
    minProfitFactor: 1.5,
    minGap: 1.0
  });

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

  // ============== MACHINE LEARNING FUNCTIONS ==============
  
  // ML Function 1: Calculate optimal mean reversion percentage from historical data
  const calculateOptimalReversionFactor = (chartData) => {
    if (chartData.length < 20) return { factor: 0.6, confidence: 0, samples: 0 };
    
    const diffs = chartData.map(d => d.diff);
    const reversionSamples = [];
    const lookback = 10;
    
    // Analyze each point where gap deviated significantly from mean
    for (let i = lookback; i < diffs.length - 5; i++) {
      const historicalDiffs = diffs.slice(i - lookback, i);
      const mean = historicalDiffs.reduce((a, b) => a + b, 0) / historicalDiffs.length;
      const stdDev = Math.sqrt(historicalDiffs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalDiffs.length);
      
      const currentDiff = diffs[i];
      const deviation = currentDiff - mean;
      
      // Only analyze significant deviations (> 0.8 std dev)
      if (Math.abs(deviation) > stdDev * 0.8) {
        // Look at next 1-5 periods to see actual reversion
        for (let horizon = 1; horizon <= Math.min(5, diffs.length - i - 1); horizon++) {
          const futureDiff = diffs[i + horizon];
          const futureDeviation = futureDiff - mean;
          
          // Calculate how much it reverted (0 = no reversion, 1 = full reversion)
          if (Math.abs(deviation) > 0.001) {
            const reversionAmount = 1 - (futureDeviation / deviation);
            // Only count valid reversions (between -0.5 and 1.5)
            if (reversionAmount > -0.5 && reversionAmount < 1.5) {
              reversionSamples.push({
                horizon,
                reversion: reversionAmount,
                initialDeviation: Math.abs(deviation),
                stdDevMultiple: Math.abs(deviation) / stdDev
              });
            }
          }
        }
      }
    }
    
    if (reversionSamples.length < 5) return { factor: 0.6, confidence: 0, samples: 0 };
    
    // Calculate weighted average reversion (weight by std dev multiple)
    const totalWeight = reversionSamples.reduce((sum, s) => sum + s.stdDevMultiple, 0);
    const weightedReversion = reversionSamples.reduce((sum, s) => sum + s.reversion * s.stdDevMultiple, 0) / totalWeight;
    
    // Calculate confidence based on sample size and consistency
    const reversionValues = reversionSamples.map(s => s.reversion);
    const reversionStdDev = Math.sqrt(reversionValues.reduce((sum, v) => sum + Math.pow(v - weightedReversion, 2), 0) / reversionValues.length);
    const consistency = Math.max(0, 1 - reversionStdDev); // Higher consistency = lower std dev
    const sampleConfidence = Math.min(1, reversionSamples.length / 50); // More samples = higher confidence
    const confidence = (consistency * 0.6 + sampleConfidence * 0.4) * 100;
    
    // Clamp reversion factor between 0.2 and 0.95
    const clampedFactor = Math.max(0.2, Math.min(0.95, weightedReversion));
    
    return {
      factor: clampedFactor,
      confidence: confidence.toFixed(1),
      samples: reversionSamples.length,
      avgHorizon: (reversionSamples.reduce((sum, s) => sum + s.horizon, 0) / reversionSamples.length).toFixed(1),
      consistency: (consistency * 100).toFixed(1)
    };
  };

  // ML Function 2: Optimize entry threshold using gradient-based search
  const optimizeEntryThreshold = (chartData) => {
    if (chartData.length < 30) return { threshold: 1.2, bestWinRate: 0, bestProfitFactor: 0 };
    
    const diffs = chartData.map(d => d.diff);
    const thresholdsToTest = [0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.5];
    let bestThreshold = 1.2;
    let bestScore = -Infinity;
    let bestWinRate = 0;
    let bestProfitFactor = 0;
    let bestTrades = 0;
    
    for (const threshold of thresholdsToTest) {
      let wins = 0, losses = 0, totalProfit = 0, totalLoss = 0;
      const lookback = 10;
      
      for (let i = lookback; i < diffs.length - 1; i++) {
        const historicalDiffs = diffs.slice(i - lookback, i);
        const mean = historicalDiffs.reduce((a, b) => a + b, 0) / historicalDiffs.length;
        const stdDev = Math.sqrt(historicalDiffs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalDiffs.length);
        
        const currentDiff = diffs[i];
        const nextDiff = diffs[i + 1];
        
        // Test SHORT signal (gap above mean)
        if (currentDiff > mean + threshold * stdDev) {
          const pnl = currentDiff - nextDiff;
          if (pnl > 0) { wins++; totalProfit += pnl; }
          else { losses++; totalLoss += Math.abs(pnl); }
        }
        // Test LONG signal (gap below mean)
        else if (currentDiff < mean - threshold * stdDev) {
          const pnl = nextDiff - currentDiff;
          if (pnl > 0) { wins++; totalProfit += pnl; }
          else { losses++; totalLoss += Math.abs(pnl); }
        }
      }
      
      const totalTrades = wins + losses;
      if (totalTrades >= 3) {
        const winRate = wins / totalTrades;
        const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 10 : 0;
        // Score combines win rate, profit factor, and trade frequency
        const score = (winRate * 40) + (Math.min(profitFactor, 3) * 20) + (Math.min(totalTrades, 20) * 2);
        
        if (score > bestScore) {
          bestScore = score;
          bestThreshold = threshold;
          bestWinRate = (winRate * 100).toFixed(1);
          bestProfitFactor = profitFactor.toFixed(2);
          bestTrades = totalTrades;
        }
      }
    }
    
    return { threshold: bestThreshold, bestWinRate, bestProfitFactor, bestTrades, bestScore: bestScore.toFixed(1) };
  };

  // ML Function 3: Calculate optimal holding period
  const calculateOptimalHoldingPeriod = (chartData) => {
    if (chartData.length < 30) return { periods: 1, expectedReturn: 0 };
    
    const diffs = chartData.map(d => d.diff);
    const holdingResults = {};
    
    for (let holdPeriod = 1; holdPeriod <= 5; holdPeriod++) {
      holdingResults[holdPeriod] = { returns: [], wins: 0, total: 0 };
    }
    
    const lookback = 10;
    for (let i = lookback; i < diffs.length - 5; i++) {
      const historicalDiffs = diffs.slice(i - lookback, i);
      const mean = historicalDiffs.reduce((a, b) => a + b, 0) / historicalDiffs.length;
      const stdDev = Math.sqrt(historicalDiffs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalDiffs.length);
      
      const currentDiff = diffs[i];
      const isSignal = Math.abs(currentDiff - mean) > stdDev * 1.0;
      
      if (isSignal) {
        const direction = currentDiff > mean ? -1 : 1; // -1 for short gap, 1 for long gap
        
        for (let holdPeriod = 1; holdPeriod <= Math.min(5, diffs.length - i - 1); holdPeriod++) {
          const exitDiff = diffs[i + holdPeriod];
          const pnl = direction * (exitDiff - currentDiff);
          holdingResults[holdPeriod].returns.push(pnl);
          holdingResults[holdPeriod].total++;
          if (pnl > 0) holdingResults[holdPeriod].wins++;
        }
      }
    }
    
    let bestPeriod = 1;
    let bestExpectedReturn = -Infinity;
    let bestWinRate = 0;
    
    for (let period = 1; period <= 5; period++) {
      const results = holdingResults[period];
      if (results.total >= 3) {
        const avgReturn = results.returns.reduce((a, b) => a + b, 0) / results.total;
        const winRate = results.wins / results.total;
        // Score combines return and win rate
        const score = avgReturn * 0.7 + winRate * 0.3;
        
        if (score > bestExpectedReturn) {
          bestExpectedReturn = score;
          bestPeriod = period;
          bestWinRate = (winRate * 100).toFixed(1);
        }
      }
    }
    
    const avgReturn = holdingResults[bestPeriod].returns.length > 0 
      ? (holdingResults[bestPeriod].returns.reduce((a, b) => a + b, 0) / holdingResults[bestPeriod].returns.length).toFixed(3)
      : 0;
    
    return { periods: bestPeriod, expectedReturn: avgReturn, winRate: bestWinRate, samples: holdingResults[bestPeriod].total };
  };
  // ML Function 4: Detect regime (trending vs mean-reverting)
  const detectMarketRegime = (chartData) => {
    if (chartData.length < 20) return { regime: 'UNKNOWN', strength: 0, recommendation: 'Insufficient data' };
    
    const diffs = chartData.map(d => d.diff);
    const returns = [];
    for (let i = 1; i < diffs.length; i++) {
      returns.push(diffs[i] - diffs[i-1]);
    }
    
    // Calculate autocorrelation at lag 1
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    let numerator = 0, denominator = 0;
    
    for (let i = 1; i < returns.length; i++) {
      numerator += (returns[i] - meanReturn) * (returns[i-1] - meanReturn);
    }
    for (let i = 0; i < returns.length; i++) {
      denominator += Math.pow(returns[i] - meanReturn, 2);
    }
    
    const autocorrelation = denominator !== 0 ? numerator / denominator : 0;
    
    // Calculate Hurst exponent approximation (R/S analysis simplified)
    const n = Math.floor(diffs.length / 2);
    const firstHalf = diffs.slice(0, n);
    const secondHalf = diffs.slice(n);
    
    const range1 = Math.max(...firstHalf) - Math.min(...firstHalf);
    const range2 = Math.max(...secondHalf) - Math.min(...secondHalf);
    const std1 = Math.sqrt(firstHalf.reduce((s, v) => s + Math.pow(v - firstHalf.reduce((a,b)=>a+b,0)/n, 2), 0) / n);
    const std2 = Math.sqrt(secondHalf.reduce((s, v) => s + Math.pow(v - secondHalf.reduce((a,b)=>a+b,0)/n, 2), 0) / n);
    
    const rs1 = std1 > 0 ? range1 / std1 : 0;
    const rs2 = std2 > 0 ? range2 / std2 : 0;
    const avgRS = (rs1 + rs2) / 2;
    
    // Estimate Hurst: H < 0.5 = mean reverting, H > 0.5 = trending
    const hurstEstimate = avgRS > 0 ? Math.log(avgRS) / Math.log(n) : 0.5;
    
    let regime, strength, recommendation;
    
    if (autocorrelation < -0.2 || hurstEstimate < 0.4) {
      regime = 'MEAN_REVERTING';
      strength = Math.min(100, Math.abs(autocorrelation) * 200 + (0.5 - hurstEstimate) * 100);
      recommendation = 'Strong mean reversion detected. Pairs trading recommended.';
    } else if (autocorrelation > 0.2 || hurstEstimate > 0.6) {
      regime = 'TRENDING';
      strength = Math.min(100, autocorrelation * 200 + (hurstEstimate - 0.5) * 100);
      recommendation = 'Trending market detected. Consider momentum strategies instead.';
    } else {
      regime = 'NEUTRAL';
      strength = 50;
      recommendation = 'No clear regime. Use conservative position sizing.';
    }
    
    return {
      regime,
      strength: strength.toFixed(1),
      autocorrelation: autocorrelation.toFixed(3),
      hurstEstimate: hurstEstimate.toFixed(3),
      recommendation
    };
  };

  // ML Function 5: Run comprehensive ML analysis
  const runMLAnalysis = (chartData) => {
    const reversionAnalysis = calculateOptimalReversionFactor(chartData);
    const thresholdOptimization = optimizeEntryThreshold(chartData);
    const holdingPeriodAnalysis = calculateOptimalHoldingPeriod(chartData);
    const regimeDetection = detectMarketRegime(chartData);
    
    // Calculate overall ML confidence
    const reversionConfidence = parseFloat(reversionAnalysis.confidence) || 0;
    const thresholdConfidence = parseFloat(thresholdOptimization.bestWinRate) || 0;
    const regimeStrength = parseFloat(regimeDetection.strength) || 0;
    
    const overallConfidence = (
      reversionConfidence * 0.3 +
      thresholdConfidence * 0.4 +
      (regimeDetection.regime === 'MEAN_REVERTING' ? regimeStrength * 0.3 : regimeStrength * 0.1)
    );
    
    return {
      reversionFactor: reversionAnalysis,
      entryThreshold: thresholdOptimization,
      holdingPeriod: holdingPeriodAnalysis,
      marketRegime: regimeDetection,
      overallConfidence: overallConfidence.toFixed(1),
      isMLReady: reversionAnalysis.samples >= 10 && thresholdOptimization.bestTrades >= 5
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
      patterns.push({ type: 'MEAN_REVERSION', strength: Math.min(Math.abs(lastDiff - mean) / stdDev * 30, 100), direction: lastDiff > mean ? 'SHORT' : 'LONG', description: `Gap ${lastDiff > mean ? 'above' : 'below'} mean by ${Math.abs(lastDiff - mean).toFixed(2)}%` });
    }
    let consecutiveDirection = 0;
    for (let i = diffs.length - 1; i > diffs.length - 6 && i > 0; i--) {
      if ((diffs[i] - diffs[i-1]) * (diffs[i-1] - diffs[i-2]) > 0) { consecutiveDirection++; } else { break; }
    }
    if (consecutiveDirection >= 2) {
      const momentum = diffs[diffs.length - 1] > diffs[diffs.length - 2] ? 'POSITIVE' : 'NEGATIVE';
      patterns.push({ type: 'MOMENTUM', strength: Math.min(consecutiveDirection * 25, 100), direction: momentum === 'POSITIVE' ? 'LONG' : 'SHORT', description: `${consecutiveDirection} consecutive moves in same direction` });
    }
    const recentVolatility = recentDiffs.reduce((sum, val) => sum + Math.abs(val), 0) / recentDiffs.length;
    const historicalVolatility = diffs.slice(0, -5).reduce((sum, val) => sum + Math.abs(val), 0) / (diffs.length - 5);
    if (recentVolatility > historicalVolatility * 1.5) {
      patterns.push({ type: 'VOLATILITY_BREAKOUT', strength: Math.min((recentVolatility / historicalVolatility) * 40, 100), direction: trend > 0 ? 'LONG' : 'SHORT', description: `Volatility increased by ${((recentVolatility / historicalVolatility - 1) * 100).toFixed(0)}%` });
    }
    const sortedDiffs = [...diffs].sort((a, b) => a - b);
    const q1 = sortedDiffs[Math.floor(sortedDiffs.length * 0.25)];
    const q3 = sortedDiffs[Math.floor(sortedDiffs.length * 0.75)];
    if (lastDiff <= q1) { patterns.push({ type: 'SUPPORT_LEVEL', strength: 70, direction: 'LONG', description: `Gap at lower quartile (support)` }); }
    else if (lastDiff >= q3) { patterns.push({ type: 'RESISTANCE_LEVEL', strength: 70, direction: 'SHORT', description: `Gap at upper quartile (resistance)` }); }
    return patterns;
  };

  const runBacktest = (chartData, mlMetrics = null) => {
    if (chartData.length < 20) return null;
    
    // Use ML-optimized threshold if available, otherwise default
    const entryThreshold = mlMetrics?.entryThreshold?.threshold || 1.2;
    
    let trades = [], wins = 0, losses = 0, totalProfit = 0;
    const lookbackPeriod = 10;
    for (let i = lookbackPeriod; i < chartData.length - 1; i++) {
      const historicalData = chartData.slice(i - lookbackPeriod, i);
      const currentDiff = chartData[i].diff;
      const nextDiff = chartData[i + 1].diff;
      const diffs = historicalData.map(d => d.diff);
      const mean = diffs.reduce((sum, val) => sum + val, 0) / diffs.length;
      const stdDev = Math.sqrt(diffs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / diffs.length);
      let entryPrice = currentDiff, exitPrice = nextDiff;
      
      if (currentDiff > mean + entryThreshold * stdDev) {
        const profitLoss = entryPrice - exitPrice;
        totalProfit += profitLoss;
        if (profitLoss > 0) wins++; else losses++;
        trades.push({ entry: i, signal: 'SHORT_GAP', entryDiff: entryPrice, exitDiff: exitPrice, profitLoss, win: profitLoss > 0 });
      } else if (currentDiff < mean - entryThreshold * stdDev) {
        const profitLoss = exitPrice - entryPrice;
        totalProfit += profitLoss;
        if (profitLoss > 0) wins++; else losses++;
        trades.push({ entry: i, signal: 'LONG_GAP', entryDiff: entryPrice, exitDiff: exitPrice, profitLoss, win: profitLoss > 0 });
      }
    }
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
    const avgWin = wins > 0 ? trades.filter(t => t.win).reduce((sum, t) => sum + t.profitLoss, 0) / wins : 0;
    const avgLoss = losses > 0 ? Math.abs(trades.filter(t => !t.win).reduce((sum, t) => sum + t.profitLoss, 0) / losses) : 0;
    const profitFactor = avgLoss > 0 ? (avgWin * wins) / (avgLoss * losses) : wins > 0 ? 999 : 0;
    return { 
      totalTrades: trades.length, wins, losses, 
      winRate: winRate.toFixed(1), 
      totalProfit: totalProfit.toFixed(2), 
      avgWin: avgWin.toFixed(2), 
      avgLoss: avgLoss.toFixed(2), 
      profitFactor: profitFactor.toFixed(2), 
      recentTrades: trades.slice(-10),
      entryThresholdUsed: entryThreshold
    };
  };
  const generatePrediction = (chartData, patterns, backtestResults, asset1Info, asset2Info, mlMetrics) => {
    if (!chartData.length || !patterns.length || !backtestResults) return null;
    const lastDiff = priceInfo.asset1 && priceInfo.asset2 ? (priceInfo.asset2.changeTimeframe - priceInfo.asset1.changeTimeframe) : 0;
    if (!priceInfo.asset1 || !priceInfo.asset2) return null;
    
    const diffs = chartData.map(d => d.diff);
    const mean = diffs.reduce((sum, val) => sum + val, 0) / diffs.length;
    const stdDev = Math.sqrt(diffs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / diffs.length);
    
    // *** USE ML-OPTIMIZED REVERSION FACTOR ***
    const mlReversionFactor = mlMetrics?.reversionFactor?.factor || 0.6;
    const mlEntryThreshold = mlMetrics?.entryThreshold?.threshold || 1.2;
    const mlHoldingPeriod = mlMetrics?.holdingPeriod?.periods || 1;
    const marketRegime = mlMetrics?.marketRegime?.regime || 'UNKNOWN';
    
    const avgWin = parseFloat(backtestResults.avgWin), avgLoss = parseFloat(backtestResults.avgLoss);
    const winRate = parseFloat(backtestResults.winRate) / 100, profitFactor = parseFloat(backtestResults.profitFactor);
    const feePerTrade = 0.15;
    const expectedValue = (winRate * avgWin) - ((1 - winRate) * avgLoss) - feePerTrade;
    const minWinRate = manualThresholds.minWinRate, minProfitFactor = manualThresholds.minProfitFactor, minGap = manualThresholds.minGap;
    const meetsWinRate = parseFloat(backtestResults.winRate) >= minWinRate;
    const meetsProfitFactor = profitFactor >= minProfitFactor;
    const meetsGap = Math.abs(lastDiff) >= minGap;
    const isProfitable = expectedValue > 0;
    
    let action, targetAsset, perpetualAction, confidence, reasoning, strategy, entryPrice, stopLoss, takeProfit, pairsTrade, autoThresholds;
    autoThresholds = { tier: 'ML_OPTIMIZED', minWinRate, minProfitFactor, minGap, expectedValue: expectedValue.toFixed(3), isProfitable, meetsWinRate, meetsProfitFactor, meetsGap };
    
    // Check if ML recommends trading based on regime
    const mlRecommendsTrade = marketRegime === 'MEAN_REVERTING' || marketRegime === 'NEUTRAL';
    const meetsAnyCriteria = (meetsWinRate || meetsProfitFactor || meetsGap) && mlRecommendsTrade;
    
    if (!meetsAnyCriteria) {
      action = 'SKIP'; targetAsset = 'NONE'; perpetualAction = 'NO TRADE';
      let reasons = [];
      if (!meetsWinRate) reasons.push(`Win rate ${backtestResults.winRate}% < ${minWinRate}% required`);
      if (!meetsProfitFactor) reasons.push(`Profit factor ${profitFactor.toFixed(2)} < ${minProfitFactor} required`);
      if (!meetsGap) reasons.push(`Gap ${Math.abs(lastDiff).toFixed(2)}% < ${minGap}% required`);
      if (!mlRecommendsTrade) reasons.push(`Market regime is ${marketRegime} - not favorable for mean reversion`);
      reasoning = `No thresholds met: ${reasons.join(', ')}`;
      strategy = `⚠️ SKIP THIS TRADE - ${reasoning}. Wait for better conditions.`;
      entryPrice = 'No entry - criteria not met'; stopLoss = 'N/A'; takeProfit = 'N/A'; pairsTrade = null; confidence = 0;
    } else {
      // *** CALCULATE EXPECTED MOVE USING ML-OPTIMIZED REVERSION FACTOR ***
      const expectedMove = lastDiff > mean 
        ? -(Math.abs(lastDiff - mean) * mlReversionFactor) 
        : Math.abs(lastDiff - mean) * mlReversionFactor;
      const targetGap = lastDiff + expectedMove;
      
      if (lastDiff > 0) {
        action = 'PAIRS'; targetAsset = asset1Info.symbol; perpetualAction = `PAIRS TRADE`;
        reasoning = `ML Analysis: ${asset2Info.symbol} is ahead by ${lastDiff.toFixed(2)}%. Historical data shows ${(mlReversionFactor * 100).toFixed(0)}% mean reversion probability. Market regime: ${marketRegime}. Optimal entry threshold: ${mlEntryThreshold}σ. Expected holding: ${mlHoldingPeriod} period(s).`;
        strategy = `PAIRS TRADE: LONG ${asset1Info.symbol} + SHORT ${asset2Info.symbol} with EQUAL $ amounts. ML predicts ${(mlReversionFactor * 100).toFixed(0)}% reversion to mean based on ${mlMetrics?.reversionFactor?.samples || 0} historical samples.`;
        entryPrice = `Execute both positions simultaneously`;
        stopLoss = `Close both if gap widens by ${(stdDev * 1.5).toFixed(2)}%`;
        takeProfit = `Close both when gap narrows by ${Math.abs(expectedMove).toFixed(2)}% (ML target)`;
        pairsTrade = { long: asset1Info.symbol, short: asset2Info.symbol, currentGap: lastDiff.toFixed(2), targetGap: targetGap.toFixed(2), expectedProfit: Math.abs(expectedMove).toFixed(2), mlReversionFactor: (mlReversionFactor * 100).toFixed(0) };
        confidence = Math.min(60 + (meetsWinRate ? 15 : 0) + (meetsProfitFactor ? 15 : 0) + (meetsGap ? 10 : 0), 100);
      } else {
        action = 'PAIRS'; targetAsset = asset2Info.symbol; perpetualAction = `PAIRS TRADE`;
        reasoning = `ML Analysis: ${asset1Info.symbol} is ahead by ${Math.abs(lastDiff).toFixed(2)}%. Historical data shows ${(mlReversionFactor * 100).toFixed(0)}% mean reversion probability. Market regime: ${marketRegime}. Optimal entry threshold: ${mlEntryThreshold}σ. Expected holding: ${mlHoldingPeriod} period(s).`;
        strategy = `PAIRS TRADE: LONG ${asset2Info.symbol} + SHORT ${asset1Info.symbol} with EQUAL $ amounts. ML predicts ${(mlReversionFactor * 100).toFixed(0)}% reversion to mean based on ${mlMetrics?.reversionFactor?.samples || 0} historical samples.`;
        entryPrice = `Execute both positions simultaneously`;
        stopLoss = `Close both if gap widens by ${(stdDev * 1.5).toFixed(2)}%`;
        takeProfit = `Close both when gap narrows by ${Math.abs(expectedMove).toFixed(2)}% (ML target)`;
        pairsTrade = { long: asset2Info.symbol, short: asset1Info.symbol, currentGap: lastDiff.toFixed(2), targetGap: targetGap.toFixed(2), expectedProfit: Math.abs(expectedMove).toFixed(2), mlReversionFactor: (mlReversionFactor * 100).toFixed(0) };
        confidence = Math.min(60 + (meetsWinRate ? 15 : 0) + (meetsProfitFactor ? 15 : 0) + (meetsGap ? 10 : 0), 100);
      }
    }
    
    const volatility = stdDev;
    const riskLevel = volatility > 2 ? 'HIGH' : volatility > 1 ? 'MEDIUM' : 'LOW';
    const expectedMoveCalc = lastDiff > mean ? -(Math.abs(lastDiff - mean) * mlReversionFactor) : Math.abs(lastDiff - mean) * mlReversionFactor;
    const targetPrice = lastDiff + expectedMoveCalc;
    
    let positionSize, leverage;
    if (riskLevel === 'HIGH') { positionSize = '1-2% of portfolio'; leverage = '2-3x leverage maximum'; }
    else if (riskLevel === 'MEDIUM') { positionSize = '2-5% of portfolio'; leverage = '3-5x leverage recommended'; }
    else { positionSize = '5-10% of portfolio'; leverage = '5-10x leverage possible'; }
    
    return { 
      action, targetAsset, perpetualAction, pairsTrade, autoThresholds, 
      confidence: confidence.toFixed(1), reasoning, strategy, entryPrice, stopLoss, takeProfit, 
      positionSize, leverage, 
      currentGap: lastDiff.toFixed(2), 
      targetGap: targetPrice.toFixed(2), 
      expectedMove: expectedMoveCalc.toFixed(2), 
      riskLevel, 
      volatility: volatility.toFixed(2), 
      patterns: patterns.map(p => p.type), 
      timeHorizon: interval === '1m' || interval === '5m' ? 'Very Short (Minutes)' : interval === '15m' || interval === '30m' ? 'Short (Hours)' : interval === '1h' || interval === '2h' || interval === '4h' ? 'Medium (Hours-Days)' : 'Long (Days-Weeks)',
      mlReversionFactor: (mlReversionFactor * 100).toFixed(0),
      mlEntryThreshold: mlEntryThreshold,
      mlHoldingPeriod: mlHoldingPeriod,
      marketRegime: marketRegime
    };
  };

  const loadData = async () => {
    setLoading(true); setError(null);
    const asset1Info = getAssetInfo(asset1), asset2Info = getAssetInfo(asset2);
    try {
      const { interval: fetchInterval, limit } = getTimeframeDetails(timeframe, interval);
      const url1 = `https://api.binance.com/api/v3/klines?symbol=${asset1}&interval=${fetchInterval}&limit=${limit}`;
      const url2 = `https://api.binance.com/api/v3/klines?symbol=${asset2}&interval=${fetchInterval}&limit=${limit}`;
      const [response1, response2] = await Promise.all([fetch(url1), fetch(url2)]);
      if (!response1.ok || !response2.ok) throw new Error('Binance API request failed');
      const data1 = await response1.json(), data2 = await response2.json();
      if (!data1.length || !data2.length) throw new Error('No data received');
      const chartData = [], minLength = Math.min(data1.length, data2.length);
      const firstPrice1 = parseFloat(data1[0][4]), firstPrice2 = parseFloat(data2[0][4]);
      const currentPrice1 = parseFloat(data1[data1.length - 1][4]), currentPrice2 = parseFloat(data2[data2.length - 1][4]);
      const fetchUrl1_24h = `https://api.binance.com/api/v3/klines?symbol=${asset1}&interval=1d&limit=2`;
      const fetchUrl2_24h = `https://api.binance.com/api/v3/klines?symbol=${asset2}&interval=1d&limit=2`;
      const [response1_24h, response2_24h] = await Promise.all([fetch(fetchUrl1_24h), fetch(fetchUrl2_24h)]);
      const data1_24h = await response1_24h.json(), data2_24h = await response2_24h.json();
      const prevDayClose1 = data1_24h.length >= 2 ? parseFloat(data1_24h[data1_24h.length - 2][4]) : firstPrice1;
      const prevDayClose2 = data2_24h.length >= 2 ? parseFloat(data2_24h[data2_24h.length - 2][4]) : firstPrice2;
      const change24h1 = ((currentPrice1 - prevDayClose1) / prevDayClose1) * 100;
      const change24h2 = ((currentPrice2 - prevDayClose2) / prevDayClose2) * 100;
      const changeTimeframe1 = ((currentPrice1 - firstPrice1) / firstPrice1) * 100;
      const changeTimeframe2 = ((currentPrice2 - firstPrice2) / firstPrice2) * 100;
      setPriceInfo({ asset1: { current: currentPrice1, previous: prevDayClose1, startPrice: firstPrice1, change: change24h1, changeTimeframe: changeTimeframe1 }, asset2: { current: currentPrice2, previous: prevDayClose2, startPrice: firstPrice2, change: change24h2, changeTimeframe: changeTimeframe2 } });
      const startPrice1 = parseFloat(data1[0][4]), startPrice2 = parseFloat(data2[0][4]);
      for (let i = 0; i < minLength; i++) {
        const currentClose1 = parseFloat(data1[i][4]), currentClose2 = parseFloat(data2[i][4]);
        const timestamp = data1[i][0], date = new Date(timestamp);
        const changeFromStart1 = ((currentClose1 - startPrice1) / startPrice1) * 100;
        const changeFromStart2 = ((currentClose2 - startPrice2) / startPrice2) * 100;
        const diff = changeFromStart2 - changeFromStart1;
        const dateFormat = limit > 90 ? { month: 'short', day: 'numeric' } : fetchInterval.includes('m') || fetchInterval.includes('h') ? { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' } : { month: 'short', day: 'numeric' };
        chartData.push({ date: date.toLocaleDateString('en-US', dateFormat), timestamp, asset1Daily: parseFloat(changeFromStart1.toFixed(2)), asset2Daily: parseFloat(changeFromStart2.toFixed(2)), diff: parseFloat(diff.toFixed(2)) });
      }
      setData(chartData);
      
      // *** RUN ML ANALYSIS ***
      const mlAnalysis = runMLAnalysis(chartData);
      setMlMetrics(mlAnalysis);
      
      const patterns = detectPatterns(chartData);
      const backtest = runBacktest(chartData, mlAnalysis);
      const prediction = generatePrediction(chartData, patterns, backtest, asset1Info, asset2Info, mlAnalysis);
      setAlgoAnalysis({ patterns, prediction }); 
      setBacktestResults(backtest);
    } catch (err) { setError(`Failed to load data: ${err.message}`); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, interval, asset1, asset2]);

  useEffect(() => {
    if (data.length > 0 && backtestResults && priceInfo.asset1 && priceInfo.asset2) {
      const asset1Info = getAssetInfo(asset1), asset2Info = getAssetInfo(asset2);
      const patterns = detectPatterns(data);
      const mlAnalysis = runMLAnalysis(data);
      setMlMetrics(mlAnalysis);
      const prediction = generatePrediction(data, patterns, backtestResults, asset1Info, asset2Info, mlAnalysis);
      setAlgoAnalysis({ patterns, prediction });
    } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualThresholds, priceInfo]);

  const asset1Info = getAssetInfo(asset1), asset2Info = getAssetInfo(asset2);
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (<div style={{ backgroundColor: 'white', padding: '14px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}><p style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '10px', color: '#333' }}>{payload[0].payload.date}</p><div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: asset1Info.color }}></div><span style={{ fontSize: '15px', color: '#555' }}>{asset1Info.symbol}: {payload[0].value}%</span></div><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: asset2Info.color }}></div><span style={{ fontSize: '15px', color: '#555' }}>{asset2Info.symbol}: {payload[1].value}%</span></div></div></div>);
    } return null;
  };
  const GapTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (<div style={{ backgroundColor: 'white', padding: '14px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}><p style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '10px', color: '#333' }}>{payload[0].payload.date}</p><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#10b981' }}></div><span style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>Gap: {payload[0].value}%</span></div></div>);
    } return null;
  };
  const avgDiff = data.length > 0 ? (data.reduce((sum, d) => sum + d.diff, 0) / data.length).toFixed(2) : 0;
  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'linear-gradient(to bottom right, #1f2937, #111827, #1f2937)', padding: '16px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ backgroundColor: '#1f2937', borderRadius: '12px 12px 0 0', border: '1px solid #374151', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>ML-Powered Crypto Analysis</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>Machine Learning Optimized Trading</p>
              <span style={{ padding: '4px 8px', backgroundColor: '#8b5cf6', color: '#e9d5ff', fontSize: '12px', fontWeight: 'bold', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Brain size={12} />ML ACTIVE</span>
            </div>
          </div>
          <button onClick={loadData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: loading ? '#4b5563' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500' }}><RefreshCw size={16} /><span>Refresh & Retrain</span></button>
        </div>

        {/* ML METRICS PANEL */}
        {mlMetrics && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '24px' }}>
            <div style={{ borderRadius: '12px', padding: '20px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(109, 40, 217, 0.3) 100%)', border: '2px solid rgba(139, 92, 246, 0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Brain size={28} color="#a78bfa" />
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: 0 }}>Machine Learning Analysis</h3>
                  <p style={{ fontSize: '13px', color: '#c4b5fd', margin: 0 }}>Parameters optimized from {mlMetrics.reversionFactor?.samples || 0} historical samples</p>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: parseFloat(mlMetrics.overallConfidence) >= 50 ? '#34d399' : '#fbbf24' }}>{mlMetrics.overallConfidence}%</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>ML Confidence</div>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>🎯 Optimal Reversion</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#a78bfa' }}>{(mlMetrics.reversionFactor?.factor * 100).toFixed(0)}%</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Confidence: {mlMetrics.reversionFactor?.confidence}%</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>📊 Entry Threshold</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#60a5fa' }}>{mlMetrics.entryThreshold?.threshold}σ</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Win Rate: {mlMetrics.entryThreshold?.bestWinRate}%</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>⏱️ Holding Period</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#34d399' }}>{mlMetrics.holdingPeriod?.periods} bar(s)</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Exp Return: {mlMetrics.holdingPeriod?.expectedReturn}%</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>📈 Market Regime</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: mlMetrics.marketRegime?.regime === 'MEAN_REVERTING' ? '#34d399' : mlMetrics.marketRegime?.regime === 'TRENDING' ? '#f87171' : '#fbbf24' }}>{mlMetrics.marketRegime?.regime?.replace('_', ' ')}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Strength: {mlMetrics.marketRegime?.strength}%</div>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '12px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: '3px solid #a78bfa' }}>
                  <div style={{ fontSize: '12px', color: '#c4b5fd', marginBottom: '6px', fontWeight: 'bold' }}>📐 Statistical Metrics</div>
                  <div style={{ fontSize: '12px', color: '#d1d5db', lineHeight: '1.6' }}>
                    Autocorrelation: <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>{mlMetrics.marketRegime?.autocorrelation}</span><br/>
                    Hurst Exponent: <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>{mlMetrics.marketRegime?.hurstEstimate}</span>
                  </div>
                </div>
                <div style={{ padding: '12px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: '3px solid #34d399' }}>
                  <div style={{ fontSize: '12px', color: '#6ee7b7', marginBottom: '6px', fontWeight: 'bold' }}>💡 ML Recommendation</div>
                  <div style={{ fontSize: '12px', color: '#d1d5db', lineHeight: '1.6' }}>{mlMetrics.marketRegime?.recommendation}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TRADE SIGNAL */}
        {algoAnalysis && algoAnalysis.prediction && algoAnalysis.prediction.action !== 'SKIP' && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '24px' }}>
            <div style={{ borderRadius: '12px', padding: '24px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 78, 59, 0.3) 100%)', border: '2px solid rgba(16, 185, 129, 0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Brain size={40} color="#34d399" />
                <div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'white' }}>{algoAnalysis.prediction.perpetualAction}</div>
                  <div style={{ fontSize: '14px', color: '#d1d5db' }}>ML Confidence: {algoAnalysis.prediction.confidence}% | Reversion: {algoAnalysis.prediction.mlReversionFactor}%</div>
                </div>
              </div>
              
              <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                <div style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '8px', fontWeight: 'bold' }}>🤖 ML ANALYSIS</div>
                <p style={{ color: '#e5e7eb', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>{algoAnalysis.prediction.reasoning}</p>
              </div>

              {algoAnalysis.prediction.pairsTrade && (
                <div style={{ padding: '16px', backgroundColor: 'rgba(34, 197, 94, 0.15)', borderRadius: '8px', border: '2px solid rgba(34, 197, 94, 0.4)', marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', color: '#6ee7b7', fontWeight: 'bold', marginBottom: '12px' }}>📊 EXECUTE BOTH POSITIONS</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.2)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '12px', color: '#6ee7b7' }}>LONG</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#34d399' }}>{algoAnalysis.prediction.pairsTrade.long}</div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '12px', color: '#fca5a5' }}>SHORT</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f87171' }}>{algoAnalysis.prediction.pairsTrade.short}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '13px', color: '#d1d5db' }}>Expected Profit: <span style={{ color: '#34d399', fontWeight: 'bold' }}>+{algoAnalysis.prediction.pairsTrade.expectedProfit}%</span> ({algoAnalysis.prediction.pairsTrade.mlReversionFactor}% ML reversion)</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>Gap: {algoAnalysis.prediction.pairsTrade.currentGap}% → {algoAnalysis.prediction.pairsTrade.targetGap}%</div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}><div style={{ fontSize: '12px', color: '#9ca3af' }}>Current Gap</div><div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>{algoAnalysis.prediction.currentGap}%</div></div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}><div style={{ fontSize: '12px', color: '#9ca3af' }}>ML Target</div><div style={{ fontSize: '20px', fontWeight: 'bold', color: '#34d399' }}>{algoAnalysis.prediction.targetGap}%</div></div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}><div style={{ fontSize: '12px', color: '#9ca3af' }}>Expected Move</div><div style={{ fontSize: '20px', fontWeight: 'bold', color: '#34d399' }}>{algoAnalysis.prediction.expectedMove}%</div></div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}><div style={{ fontSize: '12px', color: '#9ca3af' }}>Risk</div><div style={{ fontSize: '20px', fontWeight: 'bold', color: algoAnalysis.prediction.riskLevel === 'HIGH' ? '#f87171' : '#34d399' }}>{algoAnalysis.prediction.riskLevel}</div></div>
              </div>
            </div>
          </div>
        )}

        {/* NO TRADE */}
        {backtestResults && (!algoAnalysis?.prediction || algoAnalysis.prediction.action === 'SKIP') && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '24px' }}>
            <div style={{ borderRadius: '12px', padding: '24px', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(127, 29, 29, 0.2) 100%)', border: '2px solid rgba(239, 68, 68, 0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '40px' }}>🚫</div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f87171' }}>NO TRADE SIGNAL</div>
                  <div style={{ fontSize: '14px', color: '#fca5a5' }}>ML analysis doesn't recommend trading</div>
                </div>
              </div>
              <div style={{ padding: '16px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '8px' }}>
                <div style={{ fontSize: '14px', color: '#e5e7eb' }}>{algoAnalysis?.prediction?.reasoning || 'Criteria not met'}</div>
              </div>
            </div>
          </div>
        )}
        {/* MEAN REVERSION ANALYSIS */}
        {backtestResults && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '24px' }}>
            <div style={{ borderRadius: '12px', padding: '20px', backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <TrendingUp size={24} color="#34d399" />
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: 0 }}>Mean Reversion Analysis (ML-Enhanced)</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>Current {timeframe} Gap</div>
                  <div style={{ fontSize: '26px', fontWeight: 'bold', color: priceInfo.asset1 && priceInfo.asset2 && (priceInfo.asset2.changeTimeframe - priceInfo.asset1.changeTimeframe) >= 0 ? '#34d399' : '#f87171' }}>
                    {priceInfo.asset1 && priceInfo.asset2 ? ((priceInfo.asset2.changeTimeframe - priceInfo.asset1.changeTimeframe) >= 0 ? '+' : '') + (priceInfo.asset2.changeTimeframe - priceInfo.asset1.changeTimeframe).toFixed(2) : '0.00'}%
                  </div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>Mean Gap ({timeframe})</div>
                  <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#60a5fa' }}>{avgDiff}%</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>ML Reversion Factor</div>
                  <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#a78bfa' }}>{mlMetrics ? (mlMetrics.reversionFactor?.factor * 100).toFixed(0) : 60}%</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Data-driven</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>ML Target Gap</div>
                  <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#34d399' }}>{algoAnalysis?.prediction?.targetGap || avgDiff}%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BACKTEST */}
        {backtestResults && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '24px' }}>
            <div style={{ borderRadius: '12px', padding: '20px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <CheckCircle size={24} color="#60a5fa" />
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: 0 }}>Backtest (ML Threshold: {backtestResults.entryThresholdUsed}σ)</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>Win Rate</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: parseFloat(backtestResults.winRate) >= 55 ? '#34d399' : '#f87171' }}>{backtestResults.winRate}%</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>Trades</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#fff' }}>{backtestResults.totalTrades}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>Profit Factor</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: parseFloat(backtestResults.profitFactor) >= 1.5 ? '#34d399' : '#fbbf24' }}>{backtestResults.profitFactor}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>Avg Win</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#34d399' }}>+{backtestResults.avgWin}%</div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>Avg Loss</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#f87171' }}>-{backtestResults.avgLoss}%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS */}
        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Asset 1</label>
              <select value={asset1} onChange={(e) => setAsset1(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '8px' }}>
                {CRYPTO_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.symbol} - {c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Asset 2</label>
              <select value={asset2} onChange={(e) => setAsset2(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '8px' }}>
                {CRYPTO_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.symbol} - {c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Interval</label>
              <select value={interval} onChange={(e) => setInterval(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '8px' }}>
                {INTERVAL_OPTIONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* TIMEFRAME */}
        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '12px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: '#9ca3af', fontSize: '14px', marginRight: '8px' }}>Timeframe:</span>
            {['1D', '7D', '1M', '3M', '6M', '1Y', 'YTD'].map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: timeframe === tf ? '#2563eb' : '#374151', color: timeframe === tf ? 'white' : '#d1d5db', fontWeight: '500' }}>{tf}</button>
            ))}
          </div>
        </div>

        {/* CHART 1 */}
        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '24px' }}>
          <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Asset Performance</h2>
          {loading ? (
            <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} angle={-45} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="asset1Daily" stroke={asset1Info.color} strokeWidth={2} name={asset1Info.name} dot={false} />
                <Line type="monotone" dataKey="asset2Daily" stroke={asset2Info.color} strokeWidth={2} name={asset2Info.name} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* CHART 2 */}
        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', borderBottom: '1px solid #374151', borderRadius: '0 0 12px 12px', padding: '24px' }}>
          <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Gap Analysis</h2>
          {loading ? (
            <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} angle={-45} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip content={<GapTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="diff" stroke="#10b981" strokeWidth={2} name={`Gap (${asset2Info.symbol} - ${asset1Info.symbol})`} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
