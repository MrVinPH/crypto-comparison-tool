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
  { value: '1h', label: '1 Hour' }, 
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' }, 
  { value: '1w', label: '1 Week' },
];

export default function App() {
  const [data, setData] = useState([]);
  const [timeframe, setTimeframe] = useState('7D');
  const [interval, setInterval] = useState('1d');
  const [asset1, setAsset1] = useState('BTCUSDT');
  const [asset2, setAsset2] = useState('ETHUSDT');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [dataInfo, setDataInfo] = useState(null);
  const [backtest, setBacktest] = useState(null);
  const [showBacktest, setShowBacktest] = useState(false);

  const getAssetInfo = (id) => CRYPTO_OPTIONS.find(a => a.id === id) || CRYPTO_OPTIONS[0];

  const getTimeframeDetails = (tf, intv) => {
    // Get interval in hours
    const intervalHours = {
      '1h': 1,
      '4h': 4,
      '1d': 24,
      '1w': 168
    };
    
    const hours = intervalHours[intv] || 24;
    
    // Get timeframe in days
    const getTimeframeDays = (timeframe) => {
      switch(timeframe) {
        case '1D': return 1;
        case '7D': return 7;
        case '1M': return 30;
        case '3M': return 90;
        case '6M': return 180;
        case 'YTD': return getDaysYTD();
        case '1Y': return 365;
        default: return 7;
      }
    };
    
    const days = getTimeframeDays(tf);
    const totalHours = days * 24;
    
    // Calculate number of bars needed
    let limit = Math.ceil(totalHours / hours);
    
    // Binance API limit is 1000, but we cap at 500 for performance
    const maxLimit = 500;
    
    // If limit exceeds max, suggest a larger interval
    if (limit > maxLimit) {
      limit = maxLimit;
    }
    
    // Minimum 10 bars for analysis
    limit = Math.max(10, limit);
    
    return { interval: intv, limit, days, actualDays: Math.floor((limit * hours) / 24) };
  };
  
  // Helper to get days since start of year
  const getDaysYTD = () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    return Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24)) + 1; // +1 to include today
  };

  // Detect trend AND potential reversals
  const detectTrend = (chartData) => {
    if (!chartData || chartData.length < 10) {
      return { trend: 'NEUTRAL', btcChange: 0, momentum: 0, reversal: null };
    }

    const btcChange = chartData[chartData.length - 1]?.asset1Daily || 0;
    
    // Split data into older half and recent half for comparison
    const midPoint = Math.floor(chartData.length / 2);
    const olderData = chartData.slice(0, midPoint);
    const recentData = chartData.slice(midPoint);
    
    // Calculate momentum for older period vs recent period
    const olderChange = olderData[olderData.length - 1]?.asset1Daily - olderData[0]?.asset1Daily;
    const recentChange = recentData[recentData.length - 1]?.asset1Daily - recentData[0]?.asset1Daily;
    
    // Count up/down moves in last 5 bars (short-term momentum)
    const last5 = chartData.slice(-5);
    let upMoves = 0, downMoves = 0;
    for (let i = 1; i < last5.length; i++) {
      if (last5[i].asset1Daily > last5[i-1].asset1Daily) upMoves++;
      else downMoves++;
    }
    const shortMomentum = upMoves - downMoves;
    
    // Count momentum in previous 5 bars (to compare)
    const prev5 = chartData.slice(-10, -5);
    let prevUp = 0, prevDown = 0;
    if (prev5.length >= 5) {
      for (let i = 1; i < prev5.length; i++) {
        if (prev5[i].asset1Daily > prev5[i-1].asset1Daily) prevUp++;
        else prevDown++;
      }
    }
    const prevMomentum = prevUp - prevDown;
    
    // Find lowest and highest points
    const allBtc = chartData.map(d => d.asset1Daily);
    const lowestPoint = Math.min(...allBtc);
    const highestPoint = Math.max(...allBtc);
    const lowestIdx = allBtc.indexOf(lowestPoint);
    const highestIdx = allBtc.indexOf(highestPoint);
    const currentIdx = allBtc.length - 1;
    
    // Calculate how far we are from extremes
    const distanceFromLow = btcChange - lowestPoint;
    const totalRange = highestPoint - lowestPoint;
    const percentFromLow = totalRange > 0 ? (distanceFromLow / totalRange) * 100 : 50;
    
    // Base trend detection
    let trend;
    if (btcChange < -5) trend = 'STRONG_DOWNTREND';
    else if (btcChange < -2) trend = 'DOWNTREND';
    else if (btcChange > 5) trend = 'STRONG_UPTREND';
    else if (btcChange > 2) trend = 'UPTREND';
    else trend = 'NEUTRAL';
    
    // REVERSAL DETECTION
    let reversal = null;
    let reversalStrength = 0;
    let reversalReason = '';
    
    // 1. BULLISH REVERSAL: Was falling, now rising
    if (olderChange < -2 && recentChange > 0) {
      // Older period was down, recent period is up
      reversalStrength += 30;
      reversalReason = 'Price was falling, now rising. ';
    }
    
    // 2. BULLISH REVERSAL: Momentum shift from negative to positive
    if (prevMomentum < 0 && shortMomentum > 0) {
      reversalStrength += 25;
      reversalReason += 'Momentum shifted from negative to positive. ';
    }
    
    // 3. BULLISH REVERSAL: Bouncing off lows (within 20% of range from bottom)
    if (percentFromLow < 30 && shortMomentum > 0 && lowestIdx > currentIdx - 5) {
      reversalStrength += 25;
      reversalReason += `Near recent low (${lowestPoint.toFixed(2)}%), showing bounce. `;
    }
    
    // 4. BULLISH REVERSAL: Higher low pattern
    const recentLow = Math.min(...chartData.slice(-5).map(d => d.asset1Daily));
    const prevLow = Math.min(...chartData.slice(-10, -5).map(d => d.asset1Daily));
    if (recentLow > prevLow && btcChange < 0) {
      reversalStrength += 20;
      reversalReason += 'Higher low forming (bullish). ';
    }
    
    // Check for BULLISH reversal
    if (reversalStrength >= 40 && (trend.includes('DOWNTREND') || trend === 'NEUTRAL')) {
      reversal = {
        type: 'BULLISH_REVERSAL',
        strength: Math.min(100, reversalStrength),
        reason: reversalReason.trim(),
        from: trend,
        to: 'Potential UPTREND'
      };
    }
    
    // Reset for bearish check
    reversalStrength = 0;
    reversalReason = '';
    
    // 1. BEARISH REVERSAL: Was rising, now falling
    if (olderChange > 2 && recentChange < 0) {
      reversalStrength += 30;
      reversalReason = 'Price was rising, now falling. ';
    }
    
    // 2. BEARISH REVERSAL: Momentum shift from positive to negative
    if (prevMomentum > 0 && shortMomentum < 0) {
      reversalStrength += 25;
      reversalReason += 'Momentum shifted from positive to negative. ';
    }
    
    // 3. BEARISH REVERSAL: Rejecting from highs
    if (percentFromLow > 70 && shortMomentum < 0 && highestIdx > currentIdx - 5) {
      reversalStrength += 25;
      reversalReason += `Near recent high (${highestPoint.toFixed(2)}%), showing rejection. `;
    }
    
    // 4. BEARISH REVERSAL: Lower high pattern
    const recentHigh = Math.max(...chartData.slice(-5).map(d => d.asset1Daily));
    const prevHigh = Math.max(...chartData.slice(-10, -5).map(d => d.asset1Daily));
    if (recentHigh < prevHigh && btcChange > 0) {
      reversalStrength += 20;
      reversalReason += 'Lower high forming (bearish). ';
    }
    
    // Check for BEARISH reversal (only if no bullish reversal detected)
    if (!reversal && reversalStrength >= 40 && (trend.includes('UPTREND') || trend === 'NEUTRAL')) {
      reversal = {
        type: 'BEARISH_REVERSAL',
        strength: Math.min(100, reversalStrength),
        reason: reversalReason.trim(),
        from: trend,
        to: 'Potential DOWNTREND'
      };
    }

    return { 
      trend, 
      btcChange, 
      momentum: shortMomentum,
      prevMomentum,
      olderChange: olderChange.toFixed(2),
      recentChange: recentChange.toFixed(2),
      percentFromLow: percentFromLow.toFixed(0),
      reversal
    };
  };

  // Analyze BTC dominance in historical data
  const analyzeDominance = (chartData) => {
    if (!chartData || chartData.length < 10) {
      return { btcWinsInDown: 50, altWinsInUp: 50, downPeriods: 0, upPeriods: 0 };
    }

    let btcWinsDown = 0, totalDown = 0;
    let altWinsUp = 0, totalUp = 0;

    for (let i = 5; i < chartData.length; i++) {
      const btcMove = chartData[i].asset1Daily - chartData[i-5].asset1Daily;
      const altMove = chartData[i].asset2Daily - chartData[i-5].asset2Daily;

      if (btcMove < -1) { // Downtrend period
        totalDown++;
        if (btcMove > altMove) btcWinsDown++; // BTC fell less = BTC wins
      } else if (btcMove > 1) { // Uptrend period
        totalUp++;
        if (altMove > btcMove) altWinsUp++; // ALT gained more = ALT wins
      }
    }

    return {
      btcWinsInDown: totalDown > 0 ? Math.round((btcWinsDown / totalDown) * 100) : 50,
      altWinsInUp: totalUp > 0 ? Math.round((altWinsUp / totalUp) * 100) : 50,
      downPeriods: totalDown,
      upPeriods: totalUp
    };
  };

  // Calculate ML-optimized TP/SL from historical moves
  const calculateTargets = (chartData, isDowntrend) => {
    if (!chartData || chartData.length < 10) {
      return { tp: 3, sl: 2, winRate: 50 };
    }

    // Analyze historical gap moves
    const gapMoves = [];
    for (let i = 1; i < chartData.length; i++) {
      gapMoves.push(Math.abs(chartData[i].diff - chartData[i-1].diff));
    }
    
    // Sort and get percentiles
    const sorted = [...gapMoves].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 2;
    const p75 = sorted[Math.floor(sorted.length * 0.75)] || 3;
    
    // TP at 75th percentile, SL at 50th percentile
    const tp = Math.max(1.5, Math.min(6, p75));
    const sl = Math.max(1, Math.min(4, p50));

    // Estimate win rate from historical data
    let wins = 0, total = 0;
    for (let i = 5; i < chartData.length - 1; i++) {
      const gap = chartData[i].diff;
      const nextGap = chartData[i + 1].diff;
      const btcMove = chartData[i].asset1Daily - chartData[i-5].asset1Daily;
      
      if (isDowntrend && btcMove < -1) {
        // In downtrend, we bet BTC outperforms (gap widens negatively)
        if (nextGap < gap) wins++;
        total++;
      } else if (!isDowntrend && btcMove > 1) {
        // In uptrend, we bet ALT outperforms (gap narrows)
        if (nextGap > gap) wins++;
        total++;
      }
    }

    const winRate = total > 0 ? Math.round((wins / total) * 100) : 50;
    return { tp: tp.toFixed(1), sl: sl.toFixed(1), winRate };
  };

  // ============== BACKTESTING MODULE ==============
  
  const runBacktest = (chartData, tpPercent, slPercent) => {
    if (!chartData || chartData.length < 20) {
      return null;
    }
    
    const tp = parseFloat(tpPercent) || 1.5;
    const sl = parseFloat(slPercent) || 1.0;
    
    const trades = [];
    let equity = 100; // Start with $100
    const equityCurve = [{ bar: 0, equity: 100, date: chartData[0]?.date }];
    
    let inTrade = false;
    let tradeDirection = null; // 'LONG_BTC' or 'LONG_ALT'
    let entryBar = 0;
    let entryGap = 0;
    
    // Simulate through historical data
    for (let i = 15; i < chartData.length; i++) {
      const currentBar = chartData[i];
      const prevBars = chartData.slice(Math.max(0, i - 10), i);
      
      // Calculate trend at this point in time
      const btcChange = currentBar.asset1Daily;
      const gap = currentBar.diff;
      
      // Calculate historical mean gap up to this point
      const historicalGaps = chartData.slice(0, i).map(d => d.diff);
      const meanGap = historicalGaps.reduce((a, b) => a + b, 0) / historicalGaps.length;
      const stdDev = Math.sqrt(historicalGaps.reduce((s, v) => s + Math.pow(v - meanGap, 2), 0) / historicalGaps.length);
      
      // Determine trend at this point
      let trend = 'NEUTRAL';
      if (btcChange < -5) trend = 'STRONG_DOWNTREND';
      else if (btcChange < -2) trend = 'DOWNTREND';
      else if (btcChange > 5) trend = 'STRONG_UPTREND';
      else if (btcChange > 2) trend = 'UPTREND';
      
      const isDowntrend = trend.includes('DOWNTREND');
      const isUptrend = trend.includes('UPTREND');
      
      // If in a trade, check for TP/SL exit
      if (inTrade) {
        const gapMove = gap - entryGap;
        let exitReason = null;
        let pnl = 0;
        
        if (tradeDirection === 'LONG_BTC') {
          // We win if gap decreases (BTC outperforms)
          // Gap decrease = negative gapMove
          const profitMove = -gapMove; // Invert because we want gap to shrink
          
          if (profitMove >= tp) {
            exitReason = 'TP';
            pnl = tp;
          } else if (profitMove <= -sl) {
            exitReason = 'SL';
            pnl = -sl;
          }
        } else if (tradeDirection === 'LONG_ALT') {
          // We win if gap increases (ALT outperforms)
          const profitMove = gapMove;
          
          if (profitMove >= tp) {
            exitReason = 'TP';
            pnl = tp;
          } else if (profitMove <= -sl) {
            exitReason = 'SL';
            pnl = -sl;
          }
        }
        
        // Check for max holding period (10 bars)
        if (!exitReason && (i - entryBar) >= 10) {
          // Exit at current P&L
          const currentPnL = tradeDirection === 'LONG_BTC' ? -(gap - entryGap) : (gap - entryGap);
          exitReason = 'TIMEOUT';
          pnl = currentPnL;
        }
        
        if (exitReason) {
          // Close trade
          const feePercent = 0.1; // 0.1% fee per trade (0.05% each side)
          const netPnL = pnl - feePercent;
          equity = equity * (1 + netPnL / 100);
          
          trades.push({
            entryBar,
            exitBar: i,
            entryDate: chartData[entryBar]?.date,
            exitDate: currentBar.date,
            direction: tradeDirection,
            entryGap: entryGap.toFixed(2),
            exitGap: gap.toFixed(2),
            pnl: pnl.toFixed(2),
            netPnL: netPnL.toFixed(2),
            exitReason,
            equityAfter: equity.toFixed(2),
            holdingBars: i - entryBar
          });
          
          equityCurve.push({ bar: i, equity: parseFloat(equity.toFixed(2)), date: currentBar.date });
          
          inTrade = false;
          tradeDirection = null;
        }
      }
      
      // If not in a trade, check for entry signal
      if (!inTrade) {
        let signal = null;
        
        if (isDowntrend) {
          // Trend following: LONG BTC, SHORT ALT
          signal = 'LONG_BTC';
        } else if (isUptrend) {
          // Trend following: LONG ALT, SHORT BTC
          signal = 'LONG_ALT';
        } else {
          // Neutral - Mean reversion
          if (gap > meanGap + stdDev * 0.5) {
            // Gap above mean - expect to narrow - LONG BTC
            signal = 'LONG_BTC';
          } else if (gap < meanGap - stdDev * 0.5) {
            // Gap below mean - expect to widen - LONG ALT
            signal = 'LONG_ALT';
          }
        }
        
        if (signal) {
          inTrade = true;
          tradeDirection = signal;
          entryBar = i;
          entryGap = gap;
        }
      }
    }
    
    // Calculate statistics
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => parseFloat(t.netPnL) > 0);
    const losingTrades = trades.filter(t => parseFloat(t.netPnL) <= 0);
    const wins = winningTrades.length;
    const losses = losingTrades.length;
    
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    
    const grossProfit = winningTrades.reduce((sum, t) => sum + parseFloat(t.netPnL), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + parseFloat(t.netPnL), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
    
    const avgWin = wins > 0 ? grossProfit / wins : 0;
    const avgLoss = losses > 0 ? grossLoss / losses : 0;
    
    const expectancy = totalTrades > 0 
      ? ((winRate / 100) * avgWin) - ((1 - winRate / 100) * avgLoss)
      : 0;
    
    const totalReturn = equity - 100;
    const totalReturnPercent = totalReturn;
    
    // Calculate max drawdown
    let maxEquity = 100;
    let maxDrawdownPercent = 0;
    
    for (const point of equityCurve) {
      if (point.equity > maxEquity) {
        maxEquity = point.equity;
      }
      const drawdown = maxEquity - point.equity;
      const drawdownPercent = (drawdown / maxEquity) * 100;
      if (drawdownPercent > maxDrawdownPercent) {
        maxDrawdownPercent = drawdownPercent;
      }
    }
    
    // Calculate average holding period
    const avgHoldingPeriod = totalTrades > 0 
      ? trades.reduce((sum, t) => sum + t.holdingBars, 0) / totalTrades 
      : 0;
    
    // Find longest winning and losing streaks
    let currentStreak = 0;
    let longestWinStreak = 0;
    let longestLoseStreak = 0;
    let isWinStreak = true;
    
    for (const trade of trades) {
      const isWin = parseFloat(trade.netPnL) > 0;
      if (isWin === isWinStreak) {
        currentStreak++;
      } else {
        if (isWinStreak && currentStreak > longestWinStreak) longestWinStreak = currentStreak;
        if (!isWinStreak && currentStreak > longestLoseStreak) longestLoseStreak = currentStreak;
        isWinStreak = isWin;
        currentStreak = 1;
      }
    }
    // Check final streak
    if (isWinStreak && currentStreak > longestWinStreak) longestWinStreak = currentStreak;
    if (!isWinStreak && currentStreak > longestLoseStreak) longestLoseStreak = currentStreak;
    
    return {
      totalTrades,
      wins,
      losses,
      winRate: winRate.toFixed(1),
      profitFactor: profitFactor.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      grossLoss: grossLoss.toFixed(2),
      avgWin: avgWin.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
      expectancy: expectancy.toFixed(3),
      totalReturn: totalReturnPercent.toFixed(2),
      finalEquity: equity.toFixed(2),
      maxDrawdown: maxDrawdownPercent.toFixed(2),
      avgHoldingPeriod: avgHoldingPeriod.toFixed(1),
      longestWinStreak,
      longestLoseStreak,
      equityCurve,
      trades: trades.slice(-20), // Last 20 trades for display
      tp,
      sl
    };
  };

  // Main analysis function
  const runAnalysis = (chartData, asset1Info, asset2Info, prices) => {
    if (!chartData || chartData.length < 10 || !prices?.asset1 || !prices?.asset2) return null;

    const trendData = detectTrend(chartData);
    const dominance = analyzeDominance(chartData);
    
    const currentGap = prices.asset2.changeTimeframe - prices.asset1.changeTimeframe;
    const diffs = chartData.map(d => d.diff);
    const meanGap = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const stdDev = Math.sqrt(diffs.reduce((s, v) => s + Math.pow(v - meanGap, 2), 0) / diffs.length);

    // Check for reversal first - it overrides trend
    const hasReversal = trendData.reversal !== null;
    const isBullishReversal = trendData.reversal?.type === 'BULLISH_REVERSAL';
    const isBearishReversal = trendData.reversal?.type === 'BEARISH_REVERSAL';
    
    // Effective trend considers reversals
    const isDowntrend = isBearishReversal || (!hasReversal && trendData.trend.includes('DOWNTREND'));
    const isUptrend = isBullishReversal || (!hasReversal && trendData.trend.includes('UPTREND'));
    
    const targets = calculateTargets(chartData, isDowntrend);

    // Determine strategy
    let strategy, action, longAsset, shortAsset, reasoning;
    
    if (isBullishReversal) {
      // BULLISH REVERSAL - anticipate uptrend
      strategy = 'REVERSAL_TRADE';
      action = 'PAIRS_TRADE';
      longAsset = asset2Info.symbol; // Long ALT (anticipating alt outperformance)
      shortAsset = asset1Info.symbol; // Short BTC
      reasoning = `🔄 BULLISH REVERSAL DETECTED! ${trendData.reversal.reason} Current trend (${trendData.trend}) may be ending. Historically, ${asset2Info.symbol} outperforms in uptrends (${dominance.altWinsInUp}%). Position for the reversal: LONG ${asset2Info.symbol} + SHORT BTC.`;
    } else if (isBearishReversal) {
      // BEARISH REVERSAL - anticipate downtrend
      strategy = 'REVERSAL_TRADE';
      action = 'PAIRS_TRADE';
      longAsset = asset1Info.symbol; // Long BTC (safe haven)
      shortAsset = asset2Info.symbol; // Short ALT
      reasoning = `🔄 BEARISH REVERSAL DETECTED! ${trendData.reversal.reason} Current trend (${trendData.trend}) may be ending. Historically, BTC outperforms in downtrends (${dominance.btcWinsInDown}%). Position for the reversal: LONG BTC + SHORT ${asset2Info.symbol}.`;
    } else if (trendData.trend.includes('DOWNTREND')) {
      strategy = 'TREND_FOLLOWING';
      action = 'PAIRS_TRADE';
      longAsset = asset1Info.symbol;
      shortAsset = asset2Info.symbol;
      reasoning = `DOWNTREND: BTC is down ${trendData.btcChange.toFixed(2)}%. Historically, BTC outperforms ${asset2Info.symbol} in ${dominance.btcWinsInDown}% of down periods (${dominance.downPeriods} samples). Go LONG BTC + SHORT ${asset2Info.symbol}.`;
    } else if (trendData.trend.includes('UPTREND')) {
      strategy = 'TREND_FOLLOWING';
      action = 'PAIRS_TRADE';
      longAsset = asset2Info.symbol;
      shortAsset = asset1Info.symbol;
      reasoning = `UPTREND: BTC is up ${trendData.btcChange.toFixed(2)}%. Historically, ${asset2Info.symbol} outperforms BTC in ${dominance.altWinsInUp}% of up periods (${dominance.upPeriods} samples). Go LONG ${asset2Info.symbol} + SHORT BTC.`;
    } else {
      // Neutral - use mean reversion
      strategy = 'MEAN_REVERSION';
      if (Math.abs(currentGap - meanGap) < stdDev * 0.5) {
        action = 'NO_TRADE';
        longAsset = null;
        shortAsset = null;
        reasoning = `NEUTRAL: BTC ${trendData.btcChange.toFixed(2)}%. Gap (${currentGap.toFixed(2)}%) is near mean (${meanGap.toFixed(2)}%). No clear edge - wait for better setup.`;
      } else if (currentGap > meanGap) {
        action = 'PAIRS_TRADE';
        longAsset = asset1Info.symbol;
        shortAsset = asset2Info.symbol;
        reasoning = `NEUTRAL + MEAN REVERSION: Gap ${currentGap.toFixed(2)}% is above mean ${meanGap.toFixed(2)}%. Expect gap to narrow. LONG ${asset1Info.symbol} + SHORT ${asset2Info.symbol}.`;
      } else {
        action = 'PAIRS_TRADE';
        longAsset = asset2Info.symbol;
        shortAsset = asset1Info.symbol;
        reasoning = `NEUTRAL + MEAN REVERSION: Gap ${currentGap.toFixed(2)}% is below mean ${meanGap.toFixed(2)}%. Expect gap to widen. LONG ${asset2Info.symbol} + SHORT ${asset1Info.symbol}.`;
      }
    }

    // Calculate confidence - reversals get bonus confidence if strong
    let confidence = action === 'NO_TRADE' ? 0 : 50;
    if (hasReversal) {
      confidence += trendData.reversal.strength * 0.3;
    }
    confidence += Math.abs(trendData.btcChange) * 2;
    confidence += (isDowntrend ? dominance.btcWinsInDown - 50 : isUptrend ? dominance.altWinsInUp - 50 : 0) * 0.3;
    confidence = Math.min(90, confidence);

    return {
      trend: trendData,
      dominance,
      strategy,
      action,
      longAsset,
      shortAsset,
      reasoning,
      confidence: confidence.toFixed(0),
      currentGap: currentGap.toFixed(2),
      meanGap: meanGap.toFixed(2),
      stdDev: stdDev.toFixed(2),
      targets,
      prices
    };
  };

  const loadData = async () => {
    setLoading(true);
    const a1 = getAssetInfo(asset1), a2 = getAssetInfo(asset2);
    
    try {
      const tfDetails = getTimeframeDetails(timeframe, interval);
      const { interval: intv, limit, days, actualDays } = tfDetails;
      
      // Check if data is capped
      const isCapped = actualDays < days;
      setDataInfo({ 
        requestedDays: days, 
        actualDays, 
        isCapped, 
        bars: limit,
        interval: intv 
      });
      
      const [r1, r2] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/klines?symbol=${asset1}&interval=${intv}&limit=${limit}`),
        fetch(`https://api.binance.com/api/v3/klines?symbol=${asset2}&interval=${intv}&limit=${limit}`)
      ]);
      const d1 = await r1.json(), d2 = await r2.json();

      const chartData = [];
      const len = Math.min(d1.length, d2.length);
      const start1 = parseFloat(d1[0][4]), start2 = parseFloat(d2[0][4]);
      const curr1 = parseFloat(d1[len-1][4]), curr2 = parseFloat(d2[len-1][4]);

      for (let i = 0; i < len; i++) {
        const c1 = parseFloat(d1[i][4]), c2 = parseFloat(d2[i][4]);
        const ch1 = ((c1 - start1) / start1) * 100;
        const ch2 = ((c2 - start2) / start2) * 100;
        chartData.push({
          date: new Date(d1[i][0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          asset1Daily: parseFloat(ch1.toFixed(2)),
          asset2Daily: parseFloat(ch2.toFixed(2)),
          diff: parseFloat((ch2 - ch1).toFixed(2))
        });
      }

      const prices = {
        asset1: { current: curr1, changeTimeframe: ((curr1 - start1) / start1) * 100 },
        asset2: { current: curr2, changeTimeframe: ((curr2 - start2) / start2) * 100 }
      };

      setData(chartData);
      const analysisResult = runAnalysis(chartData, a1, a2, prices);
      setAnalysis(analysisResult);
      
      // Run backtest with the TP/SL from analysis
      if (analysisResult?.targets) {
        const backtestResult = runBacktest(chartData, analysisResult.targets.tp, analysisResult.targets.sl);
        setBacktest(backtestResult);
      }
    } catch (e) {
      console.error('Load error:', e);
      setBacktest(null);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); // eslint-disable-next-line
  }, [timeframe, interval, asset1, asset2]);

  const a1 = getAssetInfo(asset1), a2 = getAssetInfo(asset2);
  const isDown = analysis?.trend?.trend?.includes('DOWNTREND');
  const isUp = analysis?.trend?.trend?.includes('UPTREND');

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)', padding: '16px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ background: 'rgba(30, 41, 59, 0.9)', borderRadius: '16px 16px 0 0', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: 0 }}>🧠 Crypto Pairs Analysis</h1>
            <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: '14px' }}>ML-optimized trend detection & targets</p>
          </div>
          <button onClick={loadData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '600' }}>
            <RefreshCw size={18} />Refresh
          </button>
        </div>

        {/* Reversal Alert */}
        {analysis?.trend?.reversal && (
          <div style={{ 
            background: analysis.trend.reversal.type === 'BULLISH_REVERSAL' 
              ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.4), rgba(21, 128, 61, 0.5))' 
              : 'linear-gradient(135deg, rgba(239, 68, 68, 0.4), rgba(127, 29, 29, 0.5))',
            borderRight: '1px solid rgba(99, 102, 241, 0.3)', 
            padding: '20px 24px',
            borderLeft: `4px solid ${analysis.trend.reversal.type === 'BULLISH_REVERSAL' ? '#4ade80' : '#f87171'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '40px' }}>{analysis.trend.reversal.type === 'BULLISH_REVERSAL' ? '🔄📈' : '🔄📉'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: analysis.trend.reversal.type === 'BULLISH_REVERSAL' ? '#86efac' : '#fca5a5' }}>
                  {analysis.trend.reversal.type.replace('_', ' ')} DETECTED
                </div>
                <div style={{ color: '#e2e8f0', fontSize: '14px', marginTop: '4px' }}>
                  {analysis.trend.reversal.reason}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '8px' }}>
                  Transitioning: <span style={{ color: '#fbbf24' }}>{analysis.trend.reversal.from}</span> → <span style={{ color: analysis.trend.reversal.type === 'BULLISH_REVERSAL' ? '#4ade80' : '#f87171' }}>{analysis.trend.reversal.to}</span>
                </div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 20px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Reversal Strength</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: analysis.trend.reversal.strength >= 60 ? '#4ade80' : '#fbbf24' }}>
                  {analysis.trend.reversal.strength}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trend Banner */}
        {analysis && (
          <div style={{ 
            background: isDown ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(127, 29, 29, 0.4))' : 
                       isUp ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(21, 128, 61, 0.4))' : 
                       'linear-gradient(135deg, rgba(234, 179, 8, 0.3), rgba(161, 98, 7, 0.4))',
            borderLeft: '1px solid rgba(99, 102, 241, 0.3)', 
            borderRight: '1px solid rgba(99, 102, 241, 0.3)', 
            padding: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              {isDown ? <TrendingDown size={48} color="#f87171" /> : 
               isUp ? <TrendingUp size={48} color="#4ade80" /> : 
               <AlertTriangle size={48} color="#fbbf24" />}
              <div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: isDown ? '#fca5a5' : isUp ? '#86efac' : '#fde047' }}>
                  {analysis.trend.trend.replace(/_/g, ' ')}
                </div>
                <div style={{ color: '#e2e8f0', fontSize: '16px' }}>
                  BTC: {analysis.trend.btcChange >= 0 ? '+' : ''}{analysis.trend.btcChange.toFixed(2)}% | 
                  Momentum: {analysis.trend.momentum > 0 ? '+' : ''}{analysis.trend.momentum} 
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                    ({analysis.trend.upCount}↑ {analysis.trend.downCount}↓ in last {analysis.trend.barsAnalyzed} bars)
                  </span> |
                  Position: {analysis.trend.percentFromLow}% from low
                </div>
                <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
                  1st half: {analysis.trend.olderChange}% | 2nd half: {analysis.trend.recentChange}%
                </div>
              </div>
              <div style={{ marginLeft: 'auto', padding: '16px 24px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Strategy</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#c4b5fd' }}>{analysis.strategy.replace(/_/g, ' ')}</div>
              </div>
            </div>
          </div>
        )}

        {/* Historical Analysis */}
        {analysis && (
          <div style={{ background: 'rgba(30, 41, 59, 0.9)', borderLeft: '1px solid rgba(99, 102, 241, 0.3)', borderRight: '1px solid rgba(99, 102, 241, 0.3)', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <Brain size={24} color="#a78bfa" />
              <h3 style={{ color: 'white', margin: 0 }}>Historical Pattern Analysis</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '13px', color: '#fca5a5', marginBottom: '8px' }}>📉 BTC Dominance in Downtrends</div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#f87171' }}>{analysis.dominance.btcWinsInDown}%</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Based on {analysis.dominance.downPeriods} down periods</div>
              </div>
              <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '13px', color: '#86efac', marginBottom: '8px' }}>📈 {a2.symbol} Outperformance in Uptrends</div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#4ade80' }}>{analysis.dominance.altWinsInUp}%</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Based on {analysis.dominance.upPeriods} up periods</div>
              </div>
              <div style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '13px', color: '#a5b4fc', marginBottom: '8px' }}>📊 Current Gap ({a2.symbol} - {a1.symbol})</div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: parseFloat(analysis.currentGap) >= 0 ? '#4ade80' : '#f87171' }}>{analysis.currentGap}%</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Mean: {analysis.meanGap}% | σ: {analysis.stdDev}%</div>
              </div>
            </div>
          </div>
        )}

        {/* Trade Signal */}
        {analysis && analysis.action === 'PAIRS_TRADE' && (
          <div style={{ background: 'rgba(30, 41, 59, 0.9)', borderLeft: '1px solid rgba(99, 102, 241, 0.3)', borderRight: '1px solid rgba(99, 102, 241, 0.3)', padding: '24px' }}>
            <div style={{ 
              background: isDown ? 'linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(194, 65, 12, 0.3))' : 
                         'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(21, 128, 61, 0.3))',
              border: `2px solid ${isDown ? 'rgba(249, 115, 22, 0.5)' : 'rgba(34, 197, 94, 0.5)'}`,
              borderRadius: '16px', padding: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <CheckCircle size={48} color={isDown ? '#fb923c' : '#4ade80'} />
                <div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'white' }}>PAIRS TRADE</div>
                  <div style={{ color: '#e2e8f0' }}>Confidence: {analysis.confidence}% | Win Rate: {analysis.targets.winRate}%</div>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>📋 ANALYSIS</div>
                <p style={{ color: '#f1f5f9', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>{analysis.reasoning}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div style={{ background: 'rgba(34, 197, 94, 0.2)', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '14px', color: '#86efac', marginBottom: '8px' }}>🟢 LONG</div>
                  <div style={{ fontSize: '40px', fontWeight: 'bold', color: '#4ade80', marginBottom: '12px' }}>{analysis.longAsset}</div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                      <span style={{ color: '#94a3b8' }}>Entry</span>
                      <span style={{ color: '#fff', fontWeight: 'bold' }}>${analysis.prices[analysis.longAsset === a1.symbol ? 'asset1' : 'asset2'].current.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                      <span style={{ color: '#4ade80' }}>TP (+{analysis.targets.tp}%)</span>
                      <span style={{ color: '#4ade80', fontWeight: 'bold' }}>${(analysis.prices[analysis.longAsset === a1.symbol ? 'asset1' : 'asset2'].current * (1 + parseFloat(analysis.targets.tp)/100)).toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#f87171' }}>SL (-{analysis.targets.sl}%)</span>
                      <span style={{ color: '#f87171', fontWeight: 'bold' }}>${(analysis.prices[analysis.longAsset === a1.symbol ? 'asset1' : 'asset2'].current * (1 - parseFloat(analysis.targets.sl)/100)).toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                    </div>
                  </div>
                </div>
                <div style={{ background: 'rgba(239, 68, 68, 0.2)', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '14px', color: '#fca5a5', marginBottom: '8px' }}>🔴 SHORT</div>
                  <div style={{ fontSize: '40px', fontWeight: 'bold', color: '#f87171', marginBottom: '12px' }}>{analysis.shortAsset}</div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                      <span style={{ color: '#94a3b8' }}>Entry</span>
                      <span style={{ color: '#fff', fontWeight: 'bold' }}>${analysis.prices[analysis.shortAsset === a1.symbol ? 'asset1' : 'asset2'].current.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                      <span style={{ color: '#4ade80' }}>TP (-{analysis.targets.tp}%)</span>
                      <span style={{ color: '#4ade80', fontWeight: 'bold' }}>${(analysis.prices[analysis.shortAsset === a1.symbol ? 'asset1' : 'asset2'].current * (1 - parseFloat(analysis.targets.tp)/100)).toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#f87171' }}>SL (+{analysis.targets.sl}%)</span>
                      <span style={{ color: '#f87171', fontWeight: 'bold' }}>${(analysis.prices[analysis.shortAsset === a1.symbol ? 'asset1' : 'asset2'].current * (1 + parseFloat(analysis.targets.sl)/100)).toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Risk/Reward</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#818cf8' }}>1:{(parseFloat(analysis.targets.tp) / parseFloat(analysis.targets.sl)).toFixed(1)}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Take Profit</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4ade80' }}>+{analysis.targets.tp}%</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Stop Loss</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f87171' }}>-{analysis.targets.sl}%</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Win Rate</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fbbf24' }}>{analysis.targets.winRate}%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Trade Signal */}
        {analysis && analysis.action === 'NO_TRADE' && (
          <div style={{ background: 'rgba(30, 41, 59, 0.9)', borderLeft: '1px solid rgba(99, 102, 241, 0.3)', borderRight: '1px solid rgba(99, 102, 241, 0.3)', padding: '24px' }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(107, 114, 128, 0.2), rgba(55, 65, 81, 0.3))', border: '2px solid rgba(107, 114, 128, 0.4)', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏸️</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#9ca3af', marginBottom: '12px' }}>NO TRADE SIGNAL</div>
              <p style={{ color: '#6b7280', fontSize: '15px', maxWidth: '600px', margin: '0 auto' }}>{analysis.reasoning}</p>
            </div>
          </div>
        )}

        {/* Settings */}
        <div style={{ background: 'rgba(30, 41, 59, 0.9)', borderLeft: '1px solid rgba(99, 102, 241, 0.3)', borderRight: '1px solid rgba(99, 102, 241, 0.3)', padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Asset 1 (Base)</label>
              <select value={asset1} onChange={e => setAsset1(e.target.value)} style={{ width: '100%', padding: '12px', background: '#1e293b', color: 'white', border: '1px solid #475569', borderRadius: '8px', fontSize: '14px' }}>
                {CRYPTO_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.symbol} - {c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Asset 2 (Compare)</label>
              <select value={asset2} onChange={e => setAsset2(e.target.value)} style={{ width: '100%', padding: '12px', background: '#1e293b', color: 'white', border: '1px solid #475569', borderRadius: '8px', fontSize: '14px' }}>
                {CRYPTO_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.symbol} - {c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Interval</label>
              <select value={interval} onChange={e => setInterval(e.target.value)} style={{ width: '100%', padding: '12px', background: '#1e293b', color: 'white', border: '1px solid #475569', borderRadius: '8px', fontSize: '14px' }}>
                {INTERVAL_OPTIONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Backtest Section */}
        {backtest && (
          <div style={{ background: 'rgba(30, 41, 59, 0.9)', borderLeft: '1px solid rgba(99, 102, 241, 0.3)', borderRight: '1px solid rgba(99, 102, 241, 0.3)', padding: '24px' }}>
            
            {/* Backtest Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>📊</span>
                <div>
                  <h3 style={{ color: 'white', margin: 0, fontSize: '18px' }}>Strategy Backtest Results</h3>
                  <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: '12px' }}>
                    Simulated with TP: {backtest.tp}% | SL: {backtest.sl}% | Fee: 0.1% per trade
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowBacktest(!showBacktest)}
                style={{ padding: '8px 16px', background: '#334155', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
              >
                {showBacktest ? 'Hide Details' : 'Show Details'}
              </button>
            </div>

            {/* Key Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#a5b4fc', marginBottom: '4px' }}>Total Trades</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#818cf8' }}>{backtest.totalTrades}</div>
              </div>
              <div style={{ background: parseFloat(backtest.winRate) >= 50 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${parseFloat(backtest.winRate) >= 50 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: parseFloat(backtest.winRate) >= 50 ? '#86efac' : '#fca5a5', marginBottom: '4px' }}>Win Rate</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: parseFloat(backtest.winRate) >= 50 ? '#4ade80' : '#f87171' }}>{backtest.winRate}%</div>
              </div>
              <div style={{ background: parseFloat(backtest.profitFactor) >= 1 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${parseFloat(backtest.profitFactor) >= 1 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: parseFloat(backtest.profitFactor) >= 1 ? '#86efac' : '#fca5a5', marginBottom: '4px' }}>Profit Factor</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: parseFloat(backtest.profitFactor) >= 1 ? '#4ade80' : '#f87171' }}>{backtest.profitFactor}</div>
              </div>
              <div style={{ background: parseFloat(backtest.totalReturn) >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${parseFloat(backtest.totalReturn) >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: parseFloat(backtest.totalReturn) >= 0 ? '#86efac' : '#fca5a5', marginBottom: '4px' }}>Total Return</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: parseFloat(backtest.totalReturn) >= 0 ? '#4ade80' : '#f87171' }}>{parseFloat(backtest.totalReturn) >= 0 ? '+' : ''}{backtest.totalReturn}%</div>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#fca5a5', marginBottom: '4px' }}>Max Drawdown</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f87171' }}>-{backtest.maxDrawdown}%</div>
              </div>
              <div style={{ background: parseFloat(backtest.expectancy) >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${parseFloat(backtest.expectancy) >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: parseFloat(backtest.expectancy) >= 0 ? '#86efac' : '#fca5a5', marginBottom: '4px' }}>Expectancy</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: parseFloat(backtest.expectancy) >= 0 ? '#4ade80' : '#f87171' }}>{parseFloat(backtest.expectancy) >= 0 ? '+' : ''}{backtest.expectancy}%</div>
              </div>
            </div>

            {/* Detailed Stats - Collapsible */}
            {showBacktest && (
              <>
                {/* Secondary Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Wins / Losses</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                      <span style={{ color: '#4ade80' }}>{backtest.wins}</span>
                      <span style={{ color: '#64748b' }}> / </span>
                      <span style={{ color: '#f87171' }}>{backtest.losses}</span>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Avg Win</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#4ade80' }}>+{backtest.avgWin}%</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Avg Loss</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f87171' }}>-{backtest.avgLoss}%</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Avg Holding</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#e2e8f0' }}>{backtest.avgHoldingPeriod} bars</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Best Streak</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#4ade80' }}>{backtest.longestWinStreak} wins</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Worst Streak</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f87171' }}>{backtest.longestLoseStreak} losses</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Gross Profit</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#4ade80' }}>+{backtest.grossProfit}%</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Gross Loss</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f87171' }}>-{backtest.grossLoss}%</div>
                  </div>
                </div>

                {/* Equity Curve */}
                {backtest.equityCurve && backtest.equityCurve.length > 1 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ color: 'white', marginBottom: '12px', fontSize: '14px' }}>📈 Equity Curve (Starting: $100)</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={backtest.equityCurve}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto', 'auto']} />
                        <Tooltip 
                          contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                          formatter={(value) => [`${value}`, 'Equity']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="equity" 
                          stroke={parseFloat(backtest.totalReturn) >= 0 ? '#4ade80' : '#f87171'} 
                          strokeWidth={2} 
                          dot={false} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Trade History */}
                {backtest.trades && backtest.trades.length > 0 && (
                  <div>
                    <h4 style={{ color: 'white', marginBottom: '12px', fontSize: '14px' }}>📋 Recent Trades (Last {backtest.trades.length})</h4>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #334155' }}>
                            <th style={{ padding: '8px', textAlign: 'left', color: '#94a3b8' }}>Entry</th>
                            <th style={{ padding: '8px', textAlign: 'left', color: '#94a3b8' }}>Exit</th>
                            <th style={{ padding: '8px', textAlign: 'left', color: '#94a3b8' }}>Direction</th>
                            <th style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>Entry Gap</th>
                            <th style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>Exit Gap</th>
                            <th style={{ padding: '8px', textAlign: 'center', color: '#94a3b8' }}>Exit Reason</th>
                            <th style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>P&L</th>
                            <th style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>Equity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {backtest.trades.map((trade, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #1e293b' }}>
                              <td style={{ padding: '8px', color: '#e2e8f0' }}>{trade.entryDate}</td>
                              <td style={{ padding: '8px', color: '#e2e8f0' }}>{trade.exitDate}</td>
                              <td style={{ padding: '8px' }}>
                                <span style={{ 
                                  padding: '2px 8px', 
                                  borderRadius: '4px', 
                                  fontSize: '11px',
                                  background: trade.direction === 'LONG_BTC' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                                  color: trade.direction === 'LONG_BTC' ? '#fb923c' : '#a5b4fc'
                                }}>
                                  {trade.direction === 'LONG_BTC' ? 'Long BTC' : 'Long ALT'}
                                </span>
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right', color: '#e2e8f0' }}>{trade.entryGap}%</td>
                              <td style={{ padding: '8px', textAlign: 'right', color: '#e2e8f0' }}>{trade.exitGap}%</td>
                              <td style={{ padding: '8px', textAlign: 'center' }}>
                                <span style={{ 
                                  padding: '2px 8px', 
                                  borderRadius: '4px', 
                                  fontSize: '11px',
                                  background: trade.exitReason === 'TP' ? 'rgba(34, 197, 94, 0.2)' : trade.exitReason === 'SL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                                  color: trade.exitReason === 'TP' ? '#4ade80' : trade.exitReason === 'SL' ? '#f87171' : '#fbbf24'
                                }}>
                                  {trade.exitReason}
                                </span>
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: parseFloat(trade.netPnL) >= 0 ? '#4ade80' : '#f87171' }}>
                                {parseFloat(trade.netPnL) >= 0 ? '+' : ''}{trade.netPnL}%
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right', color: '#e2e8f0' }}>${trade.equityAfter}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '8px' }}>
                  <p style={{ color: '#fde047', fontSize: '11px', margin: 0 }}>
                    ⚠️ <strong>Disclaimer:</strong> Past performance does not guarantee future results. This backtest is based on historical data and does not account for slippage, liquidity, or market impact. Always use proper risk management.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Timeframe */}
        <div style={{ background: 'rgba(30, 41, 59, 0.9)', borderLeft: '1px solid rgba(99, 102, 241, 0.3)', borderRight: '1px solid rgba(99, 102, 241, 0.3)', padding: '16px 24px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: dataInfo?.isCapped ? '12px' : '0' }}>
            <span style={{ color: '#94a3b8', fontSize: '14px', marginRight: '8px' }}>Timeframe:</span>
            {['1D', '7D', '1M', '3M', '6M', 'YTD', '1Y'].map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: timeframe === tf ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#334155', color: 'white', fontWeight: '500', fontSize: '14px' }}>{tf}</button>
            ))}
          </div>
          
          {/* Data Info / Warning */}
          {dataInfo && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '8px 12px', 
              background: dataInfo.isCapped ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)', 
              border: `1px solid ${dataInfo.isCapped ? 'rgba(234, 179, 8, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
              borderRadius: '8px',
              fontSize: '12px'
            }}>
              {dataInfo.isCapped ? (
                <>
                  <span style={{ color: '#fbbf24' }}>⚠️</span>
                  <span style={{ color: '#fde047' }}>
                    Data capped: Showing {dataInfo.actualDays} days instead of {dataInfo.requestedDays} days ({dataInfo.bars} bars at {dataInfo.interval} interval). 
                    <span style={{ color: '#94a3b8' }}> Use a larger interval (1d or 1w) for full {timeframe} data.</span>
                  </span>
                </>
              ) : (
                <>
                  <span style={{ color: '#4ade80' }}>✓</span>
                  <span style={{ color: '#86efac' }}>
                    Showing {dataInfo.actualDays} days of data ({dataInfo.bars} bars at {dataInfo.interval} interval)
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Chart */}
        <div style={{ background: 'rgba(30, 41, 59, 0.9)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '0 0 16px 16px', padding: '24px' }}>
          <h3 style={{ color: 'white', marginBottom: '16px' }}>Performance Comparison</h3>
          {loading ? (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                <Legend />
                <Line type="monotone" dataKey="asset1Daily" stroke={a1.color} strokeWidth={2} dot={false} name={`${a1.symbol} %`} />
                <Line type="monotone" dataKey="asset2Daily" stroke={a2.color} strokeWidth={2} dot={false} name={`${a2.symbol} %`} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
