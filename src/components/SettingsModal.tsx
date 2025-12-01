import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, Wifi, Cable, HelpCircle, Hash } from 'lucide-react';
import { AppConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSave: (newConfig: AppConfig) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onSave }) => {
  const [formData, setFormData] = useState<AppConfig>(config);

  useEffect(() => {
    setFormData(config);
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'meshtasticChannelIndex' ? parseInt(value) || 0 : value 
    }));
  };

  const setMode = (mode: 'http' | 'serial') => {
    setFormData(prev => ({ ...prev, connectionMode: mode }));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-900/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Configuration
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          {/* Meshtastic Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-sky-400 uppercase tracking-wider">Meshtastic Connection</h3>
            
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setMode('http')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                  formData.connectionMode === 'http' 
                    ? 'bg-slate-700 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <Wifi size={16} />
                Network (HTTP)
              </button>
              <button
                type="button"
                onClick={() => setMode('serial')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                  formData.connectionMode === 'serial' 
                    ? 'bg-slate-700 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <Cable size={16} />
                USB (Serial)
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center gap-2">
                <Hash size={14} className="text-sky-500" />
                Channel Index
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  name="meshtasticChannelIndex"
                  min="0"
                  max="7"
                  value={formData.meshtasticChannelIndex}
                  onChange={handleChange}
                  className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-xs text-slate-500 flex-1">
                  <strong>0</strong> = Primary (Public). <br/>
                  <strong>1-7</strong> = Private Channels. 
                  <span className="block text-slate-600 italic">Check your device app for the correct index number.</span>
                </p>
              </div>
            </div>

            {formData.connectionMode === 'http' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Device Address</label>
                  <input
                    type="text"
                    name="meshtasticIp"
                    value={formData.meshtasticIp}
                    onChange={handleChange}
                    placeholder="e.g. 192.168.1.10 or http://meshtastic.local"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">IP address or hostname of your node.</p>
                </div>
                
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 text-xs text-slate-400 space-y-2">
                  <p>
                    <strong>Tip:</strong> If your radio is connected via USB and RNDIS is enabled, you can often use IP 
                    <code className="bg-slate-800 px-1 py-0.5 rounded ml-1 text-sky-300">192.168.42.1</code> here instead of Serial mode.
                  </p>
                </div>

                <div className="bg-amber-900/20 border border-amber-900/50 rounded-lg p-3 flex gap-3 items-start">
                  <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                  <div className="text-xs text-amber-200/80">
                    <strong>Mixed Content Warning:</strong> If this app is hosted on HTTPS, sending requests to a local HTTP device IP will be blocked. 
                    Use "USB (Serial)" mode or a proxy to resolve this.
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="bg-sky-900/20 border border-sky-900/50 rounded-lg p-4 text-center">
                  <div className="flex justify-center mb-2">
                    <Cable size={32} className="text-sky-500" />
                  </div>
                  <h4 className="text-white font-medium text-sm mb-1">Web Serial API</h4>
                  <p className="text-xs text-slate-400">
                    Direct USB connection from browser to radio. 
                  </p>
                </div>

                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 text-xs space-y-2">
                  <div className="font-semibold text-slate-300 flex items-center gap-1">
                    <HelpCircle size={12} />
                    Troubleshooting: "Device not found?"
                  </div>
                  <ul className="list-disc pl-4 text-slate-400 space-y-1">
                    <li><strong>Important:</strong> Ensure you are using a <strong>Data Cable</strong>. Many USB cables are charge-only.</li>
                    <li>If using an ESP32 board, you may need to install <strong>CP210x</strong> or <strong>CH340</strong> drivers.</li>
                    <li>Close other apps (like Meshtastic app, Python CLI, or Cura) that might be using the port.</li>
                    <li>Linux users: Ensure you have read/write permission (<code>dialout</code> group).</li>
                    <li>Try a different USB port.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-700 pt-6 space-y-4">
            <h3 className="text-sm font-semibold text-rose-400 uppercase tracking-wider">Source API (SR VMA)</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">SR API URL</label>
              <input
                type="text"
                name="srApiUrl"
                value={formData.srApiUrl}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">CORS Proxy (Optional)</label>
              <input
                type="text"
                name="corsProxy"
                value={formData.corsProxy}
                onChange={handleChange}
                placeholder="e.g. https://cors-anywhere.herokuapp.com/"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <p className="text-xs text-slate-500 mt-1">Prefix required if the SR API blocks cross-origin requests from this domain.</p>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              <Save size={18} />
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsModal;