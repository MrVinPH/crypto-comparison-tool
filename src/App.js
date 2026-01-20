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

function App() {
  const [data, setData] = useState([]);
  const [timeframe, setTimeframe] = useState('7D');
  const [asset1, setAsset1] = useState('BTCUSDT');
  const [asset2, setAsset2] = useState('ETHUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tradingSignal, setTradingSignal] = useState(null);
  const [priceInfo, setPriceInfo] = useState({ asset1: null, asset2: null });

  const getAssetInfo = (assetId) => CRYPTO_OPTIONS.find(a => a.id === assetId) || CRYPTO_OPTIONS[0];

  const getTimeframeDetails = (tf) => {
    switch(tf) {
      case '1D': return { interval: '1h', limit: 24 };
      case '7D': return { interval: '1d', limit: 7 };
      case '1M': return { interval: '1d', limit: 30 };
      case '3M': return { interval: '1d', limit: 90 };
      case '6M': return { interval: '1d', limit: 180 };
      case '1Y': return { interval: '1d', limit: 365 };
      default: return { interval: '1d', limit: 7 };
    }
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
    
    if (lastDiff > 2) {
      signal.action = 'LONG';
      signal.asset = asset2Info.symbol;
      signal.reason = `${asset2Info.symbol} is outperforming ${asset1Info.symbol} by ${lastDiff.toFixed(2)}%`;
      signal.strength = Math.min(Math.abs(lastDiff) / 5 * 100, 100);
    } else if (lastDiff < -2) {
      signal.action = 'LONG';
      signal.asset = asset1Info.symbol;
      signal.reason = `${asset1Info.symbol} is outperforming ${asset2Info.symbol} by ${Math.abs(lastDiff).toFixed(2)}%`;
      signal.strength = Math.min(Math.abs(lastDiff) / 5 * 100, 100);
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
      const { interval, limit } = getTimeframeDetails(timeframe);
      
      const url1 = `https://api.binance.com/api/v3/klines?symbol=${asset1}&interval=${interval}&limit=${limit}`;
      const url2 = `https://api.binance.com/api/v3/klines?symbol=${asset2}&interval=${interval}&limit=${limit}`;
      
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
      
      const lastIndex = minLength - 1;
      const prevIndex = minLength - 2;
      
      const currentPrice1 = parseFloat(data1[lastIndex][4]);
      const prevPrice1 = parseFloat(data1[prevIndex][4]);
      const currentPrice2 = parseFloat(data2[lastIndex][4]);
      const prevPrice2 = parseFloat(data2[prevIndex][4]);
      
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
      
      for (let i = 1; i < minLength; i++) {
        const currentClose1 = parseFloat(data1[i][4]);
        const prevClose1 = parseFloat(data1[i - 1][4]);
        const currentClose2 = parseFloat(data2[i][4]);
        const prevClose2 = parseFloat(data2[i - 1][4]);
        
        const timestamp = data1[i][0];
        const date = new Date(timestamp);
        
        const dailyChange1 = ((currentClose1 - prevClose1) / prevClose1) * 100;
        const dailyChange2 = ((currentClose2 - prevClose2) / prevClose2) * 100;
        const diff = dailyChange2 - dailyChange1;
        
        const dateFormat = limit > 90 
          ? { month: 'short', day: 'numeric' }
          : interval === '1h'
          ? { month: 'short', day: 'numeric', hour: 'numeric' }
          : { month: 'short', day: 'numeric' };
        
        chartData.push({
          date: date.toLocaleDateString('en-US', dateFormat),
          timestamp: timestamp,
          asset1Daily: parseFloat(dailyChange1.toFixed(2)),
          asset2Daily: parseFloat(dailyChange2.toFixed(2)),
          diff: parseFloat(diff.toFixed(2))
        });
      }

      setData(chartData);
      setTradingSignal(analyzeTradingSignal(chartData, asset1Info, asset2Info));
    } catch (err) {
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, asset1, asset2]);
  
  const asset1Info = getAssetInfo(asset1);
  const asset2Info = getAssetInfo(asset2);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'white',
          padding: '12px',
          border: '1px solid #ccc',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
            {payload[0].payload.date}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: asset1Info.color }}></div>
              <span style={{ fontSize: '14px', color: '#555' }}>{asset1Info.symbol}: {payload[0].value}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: asset2Info.color }}></div>
              <span style={{ fontSize: '14px', color: '#555' }}>{asset2Info.symbol}: {payload[1].value}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Gap: {payload[2].value}%</span>
            </div>
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
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
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
              Crypto Daily % Change Comparison
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>Live data from Binance API</p>
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
                <span style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#d1fae5',
                  borderRadius: '50%'
                }}></span>
                LIVE
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
            <span>Refresh</span>
          </button>
        </div>

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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
              <span style={{ color: '#fb923c', fontSize: '12px', fontWeight: 'bold' }}>{asset1Info.symbol} LAST CHANGE</span>
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
              <span style={{ color: '#c084fc', fontSize: '12px', fontWeight: 'bold' }}>{asset2Info.symbol} LAST CHANGE</span>
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
              <span style={{ color: '#60a5fa', fontSize: '12px', fontWeight: 'bold' }}>DAILY GAP</span>
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
            {['1D', '7D', '1M', '3M', '6M', '1Y'].map((tf) => (
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
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', color: '#d1d5db', marginBottom: '8px' }}>Loading chart...</div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>Please wait</div>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={450}>
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
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9ca3af' }} angle={-45} textAnchor="end" height={80} stroke="#4b5563" />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} label={{ value: 'Daily Change (%)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} stroke="#4b5563" />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line" />
                <Line type="monotone" dataKey="asset1Daily" stroke={asset1Info.color} strokeWidth={3} name={`${asset1Info.name} Daily %`} dot={false} fill="url(#asset1Gradient)" />
                <Line type="monotone" dataKey="asset2Daily" stroke={asset2Info.color} strokeWidth={3} name={`${asset2Info.name} Daily %`} dot={false} fill="url(#asset2Gradient)" />
                <Line type="monotone" dataKey="diff" stroke="#10b981" strokeWidth={2} name={`Gap (${asset2Info.symbol} - ${asset1Info.symbol})`} dot={false} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{
          backgroundColor: '#1f2937',
          borderRadius: '0 0 12px 12px',
          border: '1px solid #374151',
          padding: '16px 24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ color: '#9ca3af' }}>
              <span style={{ color: '#d1d5db', fontWeight: '500' }}>Trading Strategy:</span> LONG the asset with larger positive gaps consistently
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#6b7280' }}>
              <span>Live Binance Data</span>
              <span>•</span>
              <span>Gap Analysis</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
