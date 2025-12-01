import React, { useState, useEffect, useCallback } from 'react';
import { Settings, RefreshCw, Radio, Activity, Terminal, Check, Cable, Usb, AlertCircle, XCircle, ShieldAlert, Send } from 'lucide-react';
import { SrAlert, AppConfig, LogEntry } from './types';
import { DEFAULT_CONFIG, MOCK_ALERTS } from './constants';
import { fetchSrAlerts, sendToMeshtastic, serialHandler } from './services/apiService';
import SettingsModal from './components/SettingsModal';
import AlertCard from './components/AlertCard';

const App: React.FC = () => {
  const [alerts, setAlerts] = useState<SrAlert[]>([]);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [useMock, setUseMock] = useState(false);
  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [isSerialSupported, setIsSerialSupported] = useState(true);
  const [isSecureContext, setIsSecureContext] = useState(true);
  const [testMessage, setTestMessage] = useState("Test Ping");

  // Check support on mount
  useEffect(() => {
    setIsSerialSupported('serial' in navigator);
    if (typeof window !== 'undefined') {
      setIsSecureContext(window.isSecureContext);
    }
    
    // Subscribe to serial connection status changes
    serialHandler.onStatusChange((status) => {
      setIsSerialConnected(status);
      if (!status && config.connectionMode === 'serial') {
        // Optional: log if it disconnects unexpectedly
      }
    });
  }, [config.connectionMode]);

  // Load config from local storage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('vma_bridge_config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        // Ensure default properties exist if upgrading from older config
        setConfig({ ...DEFAULT_CONFIG, ...parsed });
      } catch (e) {
        console.error("Failed to parse config", e);
      }
    }
  }, []);

  const addLog = (type: LogEntry['type'], message: string) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      type,
      message
    };
    setLogs(prev => [entry, ...prev].slice(0, 50)); // Keep last 50 logs
  };

  const loadAlerts = useCallback(async () => {
    setIsLoading(true);
    addLog('info', 'Fetching alerts from SR API...');
    try {
      let fetchedAlerts: SrAlert[] = [];
      if (useMock) {
        fetchedAlerts = MOCK_ALERTS as SrAlert[];
        await new Promise(r => setTimeout(r, 800)); // Simulate delay
        addLog('warning', 'Loaded MOCK data (Simulated Mode)');
      } else {
        fetchedAlerts = await fetchSrAlerts(config);
        addLog('success', `Successfully fetched ${fetchedAlerts.length} alerts`);
      }
      setAlerts(fetchedAlerts);
    } catch (error: any) {
      console.error(error);
      addLog('error', `Fetch failed: ${error.message}`);
      // If fetch fails, suggest mock
      if (!useMock) {
        addLog('info', 'Switching to Mock Mode automatically allows you to test the UI.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [config, useMock]);

  // Initial fetch
  useEffect(() => {
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attempt auto-connect for serial if enabled and not connected
  useEffect(() => {
    if (config.connectionMode === 'serial' && !isSerialConnected) {
      const tryAutoConnect = async () => {
        const connected = await serialHandler.connectToExisting();
        if (connected) {
          addLog('success', 'Auto-connected to USB Device');
        }
      };
      tryAutoConnect();
    }
  }, [config.connectionMode]); // Removed isSerialConnected from deps to prevent loop, relying on SerialHandler state

  const handleSaveConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    localStorage.setItem('vma_bridge_config', JSON.stringify(newConfig));
    addLog('info', 'Configuration updated');
    loadAlerts(); // Reload alerts with new config
  };

  const connectSerial = async () => {
    if (!isSerialSupported) {
      addLog('error', 'Web Serial not supported. Use Chrome/Edge/Opera.');
      return;
    }
    if (!isSecureContext) {
      addLog('error', 'Security Error: Web Serial requires HTTPS or Localhost.');
      return;
    }

    try {
      await serialHandler.connect();
      // State is updated via onStatusChange listener
      addLog('success', 'Connected to Serial Device');
    } catch (e: any) {
      // Check for specific cancellation error
      if (e.message && e.message.includes('No device selected')) {
        addLog('info', 'Device selection cancelled');
      } else {
        addLog('error', 'Connection failed: ' + e.message);
        if (e.message.includes('supported') || e.message.includes('found') || e.message.includes('busy') || e.message.includes('Security')) {
           // If connection fails, open settings to show help
           // setIsSettingsOpen(true); 
        }
      }
    }
  };

  const disconnectSerial = async () => {
    try {
      await serialHandler.disconnect();
      // State is updated via onStatusChange listener
      addLog('info', 'Disconnected from Serial Device');
    } catch (e: any) {
      addLog('error', 'Error disconnecting: ' + e.message);
    }
  };

  const handleBroadcast = async (text: string) => {
    if (config.connectionMode === 'serial' && !isSerialConnected) {
      addLog('warning', 'Please connect USB device first');
      throw new Error('Device not connected');
    }

    const target = config.connectionMode === 'serial' ? 'Serial USB' : config.meshtasticIp;
    addLog('info', `Attempting to broadcast to ${target}...`);
    
    try {
      await sendToMeshtastic(config, text);
      addLog('success', 'Message sent to Meshtastic radio successfully');
    } catch (error: any) {
      addLog('error', `Broadcast failed: ${error.message}.`);
      throw error; // Propagate to card for UI state
    }
  };

  const handleTestPing = async () => {
    if (!testMessage.trim()) return;
    try {
      await handleBroadcast(testMessage);
    } catch (e) {
      // already logged
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-200 selection:bg-sky-500/30">
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        config={config}
        onSave={handleSaveConfig}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-sky-500 to-blue-600 p-2 rounded-lg shadow-lg shadow-sky-900/20">
              <Radio className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">VMA Bridge</h1>
              <p className="text-xs text-slate-400 font-mono hidden sm:block">SR API ⇄ Meshtastic Node</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {config.connectionMode === 'serial' && (
              <>
               {!isSerialConnected ? (
                <button 
                 onClick={connectSerial}
                 disabled={!isSecureContext}
                 className={`
                   flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg transition-all
                   ${!isSecureContext ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-sky-600 text-white hover:bg-sky-500 shadow-lg shadow-sky-900/20'}
                 `}
                 title={!isSecureContext ? "Requires HTTPS or Localhost" : "Open device picker"}
               >
                 <Cable size={14} />
                 Connect USB
               </button>
               ) : (
                <button 
                 onClick={disconnectSerial}
                 className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg transition-all bg-green-500/10 text-green-400 border border-green-500/50 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50 group"
                 title="Click to disconnect"
               >
                 <Cable size={14} />
                 <span className="group-hover:hidden">Connected</span>
                 <span className="hidden group-hover:inline">Disconnect</span>
               </button>
               )}
              </>
            )}

            <button
              onClick={() => setUseMock(!useMock)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${useMock ? 'bg-amber-900/30 border-amber-700 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
            >
              {useMock ? 'Mock: ON' : 'Mock: OFF'}
            </button>
            <button 
              onClick={loadAlerts}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Refresh Alerts"
            >
              <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Alert Feed */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Activity size={20} className="text-sky-500" />
                Active Alerts
              </h2>
              <span className="text-sm text-slate-500">{alerts.length} found</span>
            </div>

            {alerts.length === 0 && !isLoading ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 flex flex-col items-center justify-center text-center">
                <div className="bg-slate-800 p-4 rounded-full mb-4">
                  <Check size={32} className="text-green-500" />
                </div>
                <h3 className="text-xl font-medium text-white mb-2">All Clear</h3>
                <p className="text-slate-400 max-w-sm">
                  No VMA alerts currently found from Sveriges Radio.
                </p>
                <button onClick={() => setUseMock(true)} className="mt-6 text-sky-400 hover:underline text-sm">
                  Enable Mock Data to test UI
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <AlertCard 
                    key={alert.identifier} 
                    alert={alert} 
                    onBroadcast={handleBroadcast}
                  />
                ))}
              </div>
            )}
            
            {isLoading && alerts.length === 0 && (
               <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                 <Loader2 size={32} className="animate-spin mb-4" />
                 <p>Connecting to SR API...</p>
               </div>
            )}
          </div>

          {/* Right Column: Status & Logs */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[500px]">
              <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <h3 className="font-mono text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Terminal size={14} />
                  System Log
                </h3>
                <div className="flex gap-1.5">
                   <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
                   <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
                   <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs scrollbar-hide">
                {logs.length === 0 && (
                  <div className="text-slate-600 italic text-center mt-10">System ready. Waiting for events...</div>
                )}
                {logs.map(log => (
                  <div key={log.id} className="flex gap-3">
                    <span className="text-slate-600 shrink-0">
                      {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                    </span>
                    <span className={`break-words ${
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'success' ? 'text-green-400' :
                      log.type === 'warning' ? 'text-amber-400' :
                      'text-sky-200'
                    }`}>
                      {log.type === 'error' && 'ERR: '}
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Connection Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Target Mode</span>
                  {config.connectionMode === 'serial' ? (
                     <span className="font-mono text-indigo-400 bg-indigo-950/30 px-2 py-0.5 rounded flex items-center gap-1">
                        <Usb size={12} />
                        USB Serial
                     </span>
                  ) : (
                    <span className="font-mono text-sky-400 bg-sky-950/30 px-2 py-0.5 rounded">
                      {config.meshtasticIp}
                    </span>
                  )}
                </div>
                {config.connectionMode === 'serial' && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Port Status</span>
                    <span className={`font-bold transition-colors ${isSerialConnected ? "text-green-400" : "text-amber-500"}`}>
                      {isSerialConnected ? "Open / Ready" : "Disconnected"}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">API Source</span>
                  <span className="font-mono text-slate-300">Sveriges Radio V2</span>
                </div>
                {!isSerialSupported && (
                  <div className="mt-2 text-xs text-red-400 bg-red-900/20 p-2 rounded flex gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    Browser does not support Serial API.
                  </div>
                )}
                {!isSecureContext && config.connectionMode === 'serial' && (
                  <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-3 flex gap-3 items-start animate-pulse">
                    <ShieldAlert className="text-red-500 shrink-0 mt-0.5" size={16} />
                    <div className="text-xs text-red-200/80">
                      <strong>Security Error:</strong> You are not in a Secure Context. Web Serial API requires <strong>https://</strong> or <strong>localhost</strong>.
                    </div>
                  </div>
                )}
              </div>

              {/* Test Ping Section */}
              <div className="mt-4 pt-4 border-t border-slate-800">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Test Radio</h4>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                    placeholder="Message..."
                  />
                  <button 
                    onClick={handleTestPing}
                    className="bg-sky-600/20 hover:bg-sky-600/40 text-sky-400 border border-sky-600/50 rounded-lg px-3 py-1.5 transition-colors"
                    title="Send Ping"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 text-xs text-slate-500 leading-relaxed">
              <strong className="text-slate-400 block mb-1">Developer Note:</strong>
              {config.connectionMode === 'serial' ? (
                 <span>
                   Browser serial API requires a secure context (HTTPS) or localhost. Ensure your browser supports Web Serial (Chrome/Edge).
                 </span>
              ) : (
                <span>
                   When using HTTP to connect to a local IP, you may encounter "Mixed Content" errors if this page is served via HTTPS.
                </span>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

// Helper for loading icon
function Loader2({ size = 24, className = "" }: { size?: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export default App;