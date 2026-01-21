const calculateTechnicalIndicators = (chartData) => {
    if (chartData.length < 20) return null;
    
    const diffs = chartData.map(d => d.diff);
    
    // Moving Averages for gap
    const ma20 = diffs.slice(-20).reduce((sum, val) => sum + val, 0) / 20;
    const ma50 = diffs.length >= 50 ? diffs.slice(-50).reduce((sum, val) => sum + val, 0) / 50 : ma20;
    
    // RSI calculation for gap (14-period)
    const calculateRSI = (values, period = 14) => {
      if (values.length < period + 1) return 50;
      const changes = [];
      for (let i = 1; i < values.length; i++) {
        changes.push(values[i] - values[i - 1]);
      }
      const recentChanges = changes.slice(-period);
      const gains = recentChanges.filter(c => c > 0).reduce((sum, c) => sum + c, 0) / period;
      const losses = Math.abs(recentChanges.filter(c => c < 0).reduce((sum, c) => sum + c, 0)) / period;
      if (losses === 0) return 100;
      const rs = gains / losses;
      return 100 - (100 / (1 + rs));
    };
    
    const rsi = calculateRSI(diffs);
    
    // Bollinger Bands
    const mean = diffs.reduce((sum, val) => sum + val, 0) / diffs.length;
    const stdDev = Math.sqrt(diffs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / diffs.length);
    const upperBand = mean + (2 * stdDev);
    const lowerBand = mean - (2 * stdDev);
    
    // Support and Resistance levels (using pivot points and local extrema)
    const findSupportResistance = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      const support1 = sorted[Math.floor(sorted.length * 0.15)];
      const support2 = sorted[Math.floor(sorted.length * 0.05)];
      const resistance1 = sorted[Math.floor(sorted.length * 0.85)];
      const resistance2 = sorted[Math.floor(sorted.length * 0.95)];
      
      return { support1, support2, resistance1, resistance2 };
    };
    
    const srLevels = findSupportResistance(diffs);
    
    // Trend detection (linear regression)
    const calculateTrend = (values) => {
      const n = values.length;
      const x = Array.from({ length: n }, (_, i) => i);
      const y = values;
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = y.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
      const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      return { slope, intercept, strength: Math.abs(slope) };
    };
    
    const shortTermTrend = calculateTrend(diffs.slice(-10));
    const mediumTermTrend = calculateTrend(diffs.slice(-30));
    const longTermTrend = calculateTrend(diffs);
    
    return {
      ma20,
      ma50,
      rsi,
      upperBand,
      lowerBand,
      mean,
      stdDev,
      supportResistance: srLevels,
      trends: {
        short: shortTermTrend,
        medium: mediumTermTrend,
        long: longTermTrend
      }
    };
  };

  const detectPatterns = (chartData, technicals) => {
    if (chartData.length < 10 || !technicals) return [];
    
    const patterns = [];
    const diffs = chartData.map(d => d.diff);
    const lastDiff = diffs[diffs.length - 1];
    
    // Trend Analysis
    const shortTrend = technicals.trends.short.slope > 0 ? 'UPTREND' : 'DOWNTREND';
    const trendStrength = (Math.abs(technicals.trends.short.slope) + Math.abs(technicals.trends.medium.slope)) / 2;
    
    if (trendStrength > 0.1) {
      patterns.push({
        type: shortTrend,
        strength: Math.min(trendStrength * 200, 100),
        direction: shortTrend === 'UPTREND' ? 'LONG' : 'SHORT',
        description: `${shortTrend} detected with strength ${(trendStrength * 100).toFixed(1)}%`
      });
    }
    
    // Mean Reversion with Bollinger Bands
    if (lastDiff > technicals.upperBand) {
      patterns.push({
        type: 'BOLLINGER_UPPER',
        strength: Math.min(((lastDiff - technicals.upperBand) / technicals.stdDev) * 40, 100),
        direction: 'SHORT',
        description: `Price above upper Bollinger Band (${technicals.upperBand.toFixed(2)}%)`
      });
    } else if (lastDiff < technicals.lowerBand) {
      patterns.push({
        type: 'BOLLINGER_LOWER',
        strength: Math.min(((technicals.lowerBand - lastDiff) / technicals.stdDev) * 40, 100),
        direction: 'LONG',
        description: `Price below lower Bollinger Band (${technicals.lowerBand.toFixed(2)}%)`
      });
    }
    
    // RSI Analysis
    if (technicals.rsi > 70) {
      patterns.push({
        type: 'RSI_OVERBOUGHT',
        strength: Math.min((technicals.rsi - 70) * 2, 100),
        direction: 'SHORT',
        description: `RSI overbought at ${technicals.rsi.toFixed(1)}`
      });
    } else if (technicals.rsi < 30) {
      patterns.push({
        type: 'RSI_OVERSOLD',
        strength: Math.min((30 - technicals.rsi) * 2, 100),
        direction: 'LONG',
        description: `RSI oversold at ${technicals.rsi.toFixed(1)}`
      });
    }
    
    // Support/Resistance Analysis
    const tolerance = technicals.stdDev * 0.3;
    if (Math.abs(lastDiff - technicals.supportResistance.support1) < tolerance) {
      patterns.push({
        type: 'AT_SUPPORT',
        strength: 75,
        direction: 'LONG',
        description: `Price at support level (${technicals.supportResistance.support1.toFixed(2)}%)`
      });
    } else if (Math.abs(lastDiff - technicals.supportResistance.resistance1) < tolerance) {
      patterns.push({
        type: 'AT_RESISTANCE',
        strength: 75,
        direction: 'SHORT',
        description: `Price at resistance level (${technicals.supportResistance.resistance1.toFixed(2)}%)`
      });
    }
    
    // Moving Average Crossover
    if (technicals.ma20 > technicals.ma50 && diffs[diffs.length - 20] <= diffs[diffs.length - 50]) {
      patterns.push({
        type: 'MA_GOLDEN_CROSS',
        strength: 80,
        direction: 'LONG',
        description: `MA20 crossed above MA50 (bullish)`
      });
    } else if (technicals.ma20 < technicals.ma50 && diffs[diffs.length - 20] >= diffs[diffs.length - 50]) {
      patterns.push({
        type: 'MA_DEATH_CROSS',
        strength: 80,
        direction: 'SHORT',
        description: `MA20 crossed below MA50 (bearish)`
      });
    }
    
    // Momentum
    const recentDiffs = diffs.slice(-5);
    let consecutiveDirection = 0;
    for (let i = recentDiffs.length - 1; i > 0; i--) {
      if ((recentDiffs[i] - recentDiffs[i-1]) * (recentDiffs[i-1] - recentDiffs[i-2]) > 0) {
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
    
    // Volatility Analysis
    const recentVolatility = recentDiffs.reduce((sum, val) => sum + Math.abs(val), 0) / recentDiffs.length;
    const historicalVolatility = diffs.slice(0, -5).reduce((sum, val) => sum + Math.abs(val), 0) / (diffs.length - 5);
    
    if (recentVolatility > historicalVolatility * 1.5) {
      patterns.push({
        type: 'VOLATILITY_BREAKOUT',
        strength: Math.min((recentVolatility / historicalVolatility) * 40, 100),
        direction: shortTrend === 'UPTREND' ? 'LONG' : 'SHORT',
        description: `Volatility increased by ${((recentVolatility / historicalVolatility - 1) * 100).toFixed(0)}%`
      });
    }
    
    return patterns;
  };
