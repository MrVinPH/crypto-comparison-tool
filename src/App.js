import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown, ArrowUpCircle } from 'lucide-react';

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

const TIMEFRAMES = [
  { id: '1D', label: '1 Day', days: 1 },
  { id: '7D', label: '7 Days', days: 7 },
  { id: '1M', label: '1 Month', days: 30 },
  { id: '3M', label: '3 Months', days: 90 },
  { id: '6M', label: '6 Months', days: 180 },
  { id: 'YTD', label: 'Year to Date', days: 'ytd' },
  { id: '1Y', label: '1 Year', days: 365 },
];

const INTERVALS = [
  { id: '1h', label: '1 Hour', binance: '1h' },
  { id: '2h', label: '2 Hours', binance: '2h' },
  { id: '4h', label: '4 Hours', binance: '4h' },
  { id: '1d', label: '1 Day', binance: '1d' },
  { id: '1w', label: '1 Week', binance: '1w' },
  { id: '1M', label: '1 Month', binance: '1M' },
];

function App() {
  const [priceData, setPriceData] = useState([]);
  const [gapData, setGapData] = useState([]);
  const [timeframe, setTimeframe] = useState('7D');
  const [interval, setInterval] = useState('1d');
  const [asset1, setAsset1] = useState('BTCUSDT');
  const [asset2, setAsset2] = useState('ETHUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tradingSignal, setTradingSignal] = useState(null);
  const [priceInfo, setPriceInfo] = useState({ asset1: null, asset2: null });

  const getAssetInfo = (assetId) => CRYPTO_OPTIONS.find(a => a.id === assetId) || CRYPTO_OPTIONS[0];

  const getTimeframeDays = (tf) => {
    if (tf === 'YTD') {
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1);
      return Math.ceil((now - yearStart) / (24 * 60 * 60 * 1000));
    }
    const found = TIMEFRAMES.find(t => t.id === tf);
    return found ? found.days : 7;
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
      signal.reason = `${asset2Info.symbol} outperforming ${asset1Info.symbol} by ${lastDiff.toFixed(2)}%`;
      signal.strength = Math.min(Math.abs(lastDiff) / 3 * 100, 100);
    } else if (lastDiff < -0.5) {
      signal.action = 'LONG';
      signal.asset = asset1Info.symbol;
      signal.reason = `${asset1Info.symbol} outperforming ${asset2Info.symbol} by ${Math.abs(lastDiff).toFixed(2)}%`;
      signal.strength = Math.min(Math.abs(lastDiff) / 3 * 100, 100);
    } else {
      signal.action = 'NEUTRAL';
      signal.asset = 'BOTH';
      signal.reason = `Small gap between ${asset1Info.symbol} and ${asset2Info.symbol}`;
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
      const days = getTimeframeDays(timeframe);
      const binanceInterval = INTERVALS.find(i => i.id === interval)?.binance || '1d';
      
      let limit;
      if (binanceInterval === '1h') {
        limit = Math.min(days * 24, 1000);
      } else if (binanceInterval === '2h') {
        limit = Math.min(days * 12, 1000);
      } else if (binanceInterval === '4h') {
        limit = Math.min(days * 6, 1000);
      } else if (binanceInterval === '1d') {
        limit = Math.min(days, 1000);
      } else if (binanceInterval === '1w') {
        limit = Math.min(Math.ceil(days / 7), 1000);
      } else if (binanceInterval === '1M') {
        limit = Math.min(Math.ceil(days / 30), 1000);
      } else {
        limit = Math.min(days, 1000);
      }

      const url1 = `https://api.binance.com/api/v3/klines?symbol=${asset1}&interval=${binanceInterval}&limit=${limit}`;
      const url2 = `https://api.binance.com/api/v3/klines?symbol=${asset2}&interval=${binanceInterval}&limit=${limit}`;
      
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

      const startPrice1 = parseFloat(data1[0][4]);
      const startPrice2 = parseFloat(data2[0][4]);
      
      const currentPrice1 = parseFloat(data1[data1.length - 1][4]);
      const currentPrice2 = parseFloat(data2[data2.length - 1][4]);
      
      setPriceInfo({
        asset1: {
          current: currentPrice1,
          previous: startPrice1,
          change: ((currentPrice1 - startPrice1) / startPrice1) * 100
        },
        asset2: {
          current: currentPrice2,
          previous: startPrice2,
          change: ((currentPrice2 - startPrice2) / startPrice2) * 100
        }
      });

      const priceChartData = [];
      const gapChartData = [];
      const minLength = Math.min(data1.length, data2.length);
      
      for (let i = 0; i < minLength; i++) {
        const currentClose1 = parseFloat(data1[i][4]);
        const currentClose2 = parseFloat(data2[i][4]);
        
        const timestamp = data1[i][0];
        const date = new Date(timestamp);
        
        const percentChange1 = ((currentClose1 - startPrice1) / startPrice1) * 100;
        const percentChange2 = ((currentClose2 - startPrice2) / startPrice2) * 100;
        const diff = percentChange2 - percentChange1;
        
        let dateFormat;
        if (binanceInterval === '1h' || binanceInterval === '2h' || binanceInterval === '4h') {
          dateFormat = date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' });
        } else if (binanceInterval === '1w' || binanceInterval === '1M') {
          dateFormat = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        } else {
          dateFormat = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        
        priceChartData.push({
          date: dateFormat,
          timestamp: timestamp,
          asset1Change: parseFloat(percentChange1.toFixed(2)),
          asset2Change: parseFloat(percentChange2.toFixed(2)),
        });

        gapChartData.push({
          date: dateFormat,
          timestamp: timestamp,
          diff: parseFloat(diff.toFixed(2))
        });
      }

      setPriceData(priceChartData);
      setGapData(gapChartData);
      setTradingSignal(analyzeTradingSignal(gapChartData, asset1Info, asset2Info));
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

  const PriceTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'white', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>{payload[0].payload.date}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: asset1Info.color }}></div>
              <span style={{ fontSize: '14px', color: '#555' }}>{asset1Info.symbol}: {payload[0].value}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: asset2Info.color }}></div>
              <span style={{ fontSize: '14px', color: '#555' }}>{asset2Info.symbol}: {payload[1].value}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const GapTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      return (
        <div style={{ backgroundColor: 'white', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>{payload[0].payload.date}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: value >= 0 ? '#10b981' : '#ef4444' }}></div>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Gap: {value >= 0 ? '+' : ''}{value}%</span>
          </div>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{value >= 0 ? `${asset2Info.symbol} ahead` : `${asset1Info.symbol} ahead`}</p>
        </div>
      );
    }
    return null;
  };

  const currentStats = priceData.length > 0 ? priceData[priceData.length - 1] : { asset1Change: 0, asset2Change: 0 };
  const currentGap = gapData.length > 0 ? gapData[gapData.length - 1].diff : 0;

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'linear-gradient(to bottom right, #1f2937, #111827, #1f2937)', padding: '16px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ backgroundColor: '#1f2937', borderRadius: '12px 12px 0 0', border: '1px solid #374151', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>Crypto Comparison Tool</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>% change from {timeframe} start • Live Binance data</p>
              <span style={{ padding: '4px 8px', backgroundColor: '#10b981', color: '#d1fae5', fontSize: '12px', fontWeight: 'bold', borderRadius: '4px' }}>LIVE</span>
            </div>
          </div>
          <button onClick={loadData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: loading ? '#4b5563' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>

        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '24px' }}>
          {error && (
            <div style={{ marginBottom: '16px', backgroundColor: 'rgba(127, 29, 29, 0.5)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '8px', padding: '16px' }}>
              <span style={{ color: '#fca5a5', fontWeight: 'bold' }}>⚠️ API Error</span>
              <p style={{ color: '#fecaca', fontSize: '14px' }}>{error}</p>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>Asset 1</label>
              <select value={asset1} onChange={(e) => setAsset1(e.target.value)} style={{ width: '100%', padding: '8px 16px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                {CRYPTO_OPTIONS.map(crypto => (
                  <option key={crypto.id} value={crypto.id}>{crypto.symbol} - {crypto.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>Asset 2</label>
              <select value={asset2} onChange={(e) => setAsset2(e.target.value)} style={{ width: '100%', padding: '8px 16px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                {CRYPTO_OPTIONS.map(crypto => (
                  <option key={crypto.id} value={crypto.id}>{crypto.symbol} - {crypto.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {tradingSignal && (
          <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '24px' }}>
            <div style={{ borderRadius: '8px', padding: '16px', border: tradingSignal.action === 'LONG' ? '2px solid rgba(16, 185, 129, 0.5)' : '2px solid rgba(75, 85, 99, 0.5)', backgroundColor: tradingSignal.action === 'LONG' ? 'rgba(6, 78, 59, 0.3)' : 'rgba(55, 65, 81, 0.3)' }}>
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
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#34d399' }}>{tradingSignal.strength.toFixed(0)}%</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>Signal Strength</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', padding: '16px 24px', backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151' }}>
          <div style={{ background: 'linear-gradient(to bottom right, rgba(249, 115, 22, 0.2), rgba(249, 115, 22, 0.1))', border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#fb923c', fontSize: '12px', fontWeight: 'bold' }}>{asset1Info.symbol} ({timeframe})</span>
              {currentStats.asset1Change >= 0 ? <TrendingUp size={16} color="#34d399" /> : <TrendingDown size={16} color="#f87171" />}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: currentStats.asset1Change >= 0 ? '#34d399' : '#f87171' }}>
              {currentStats.asset1Change >= 0 ? '+' : ''}{currentStats.asset1Change}%
            </div>
            {priceInfo.asset1 && (
              <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px' }}>
                <div>Now: ${priceInfo.asset1.current.toLocaleString()}</div>
                <div>{timeframe} Start: ${priceInfo.asset1.previous.toLocaleString()}</div>
              </div>
            )}
          </div>
          
          <div style={{ background: 'linear-gradient(to bottom right, rgba(168, 85, 247, 0.2), rgba(168, 85, 247, 0.1))', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#c084fc', fontSize: '12px', fontWeight: 'bold' }}>{asset2Info.symbol} ({timeframe})</span>
              {currentStats.asset2Change >= 0 ? <TrendingUp size={16} color="#34d399" /> : <TrendingDown size={16} color="#f87171" />}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: currentStats.asset2Change >= 0 ? '#34d399' : '#f87171' }}>
              {currentStats.asset2Change >= 0 ? '+' : ''}{currentStats.asset2Change}%
            </div>
            {priceInfo.asset2 && (
              <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px' }}>
                <div>Now: ${priceInfo.asset2.current.toLocaleString()}</div>
                <div>{timeframe} Start: ${priceInfo.asset2.previous.toLocaleString()}</div>
              </div>
            )}
          </div>
          
          <div style={{ background: 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#60a5fa', fontSize: '12px', fontWeight: 'bold' }}>PERFORMANCE GAP</span>
              {currentGap >= 0 ? <TrendingUp size={16} color="#34d399" /> : <TrendingDown size={16} color="#f87171" />}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: currentGap >= 0 ? '#34d399' : '#f87171' }}>
              {currentGap >= 0 ? '+' : ''}{currentGap}%
            </div>
            <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px' }}>
              {currentGap >= 0 ? `${asset2Info.symbol} outperforming` : `${asset1Info.symbol} outperforming`}
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '12px 24px' }}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '500' }}>Timeframe:</span>
              {TIMEFRAMES.map((tf) => (
                <button key={tf.id} onClick={() => setTimeframe(tf.id)} style={{ padding: '6px 12px', borderRadius: '8px', fontWeight: '500', fontSize: '13px', border: 'none', cursor: 'pointer', backgroundColor: timeframe === tf.id ? '#2563eb' : '#374151', color: timeframe === tf.id ? 'white' : '#d1d5db' }}>
                  {tf.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '500' }}>Interval:</span>
              {INTERVALS.map((int) => (
                <button key={int.id} onClick={() => setInterval(int.id)} style={{ padding: '6px 12px', borderRadius: '8px', fontWeight: '500', fontSize: '13px', border: 'none', cursor: 'pointer', backgroundColor: interval === int.id ? '#7c3aed' : '#374151', color: interval === int.id ? 'white' : '#d1d5db' }}>
                  {int.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '24px', borderTop: '1px solid #374151' }}>
          <h3 style={{ color: 'white', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Price % Change from {timeframe} Start</h3>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '350px' }}>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: '18px', color: '#d1d5db' }}>Loading...</div></div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={priceData}>
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
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} angle={-45} textAnchor="end" height={70} stroke="#4b5563" />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} label={{ value: '% Change', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} stroke="#4b5563" />
                <Tooltip content={<PriceTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '15px' }} iconType="line" />
                <Line type="monotone" dataKey="asset1Change" stroke={asset1Info.color} strokeWidth={2.5} name={asset1Info.symbol} dot={false} fill="url(#asset1Gradient)" />
                <Line type="monotone" dataKey="asset2Change" stroke={asset2Info.color} strokeWidth={2.5} name={asset2Info.symbol} dot={false} fill="url(#asset2Gradient)" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ backgroundColor: '#1f2937', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '24px', borderTop: '1px solid #374151' }}>
          <h3 style={{ color: 'white', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Performance Gap ({asset2Info.symbol} - {asset1Info.symbol})</h3>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '350px' }}>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: '18px', color: '#d1d5db' }}>Loading...</div></div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={gapData}>
                <defs>
                  <linearGradient id="gapGradientPos" x1="0" y1="0" x2="0" y2="1">
                    <stopoffset="5%" stopColor="#10b981" stopOpacity={0.3}/>
<stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
</linearGradient>
</defs>
<CartesianGrid strokeDasharray="3 3" stroke="#374151" />
<XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} angle={-45} textAnchor="end" height={70} stroke="#4b5563" />
<YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} label={{ value: 'Gap %', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} stroke="#4b5563" />
<Tooltip content={<GapTooltip />} />
<Legend wrapperStyle={{ paddingTop: '15px' }} iconType="line" />
<Line type="monotone" dataKey="diff" stroke="#10b981" strokeWidth={3} name="Performance Gap" dot={false} fill="url(#gapGradientPos)" />
</LineChart>
</ResponsiveContainer>
)}
</div>
    <div style={{ backgroundColor: '#1f2937', borderRadius: '0 0 12px 12px', border: '1px solid #374151', padding: '16px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ color: '#9ca3af' }}>
          <span style={{ color: '#d1d5db', fontWeight: '500' }}>Strategy:</span> LONG when gap ≥ +0.5% | SHORT when gap ≤ -0.5%
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#6b7280' }}>
          <span>Live Binance</span>
          <span>•</span>
          <span>Sensitive Signals</span>
        </div>
      </div>
    </div>
  </div>
</div>
