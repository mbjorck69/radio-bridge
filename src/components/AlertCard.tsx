import React, { useState } from 'react';
import { SrAlert } from '../types';
import { Radio, AlertOctagon, MapPin, Check } from 'lucide-react';

interface AlertCardProps {
  alert: SrAlert;
  onBroadcast: (text: string) => Promise<void>;
}

const AlertCard: React.FC<AlertCardProps> = ({ alert, onBroadcast }) => {
  const [isSending, setIsSending] = useState(false);
  const [lastStatus, setLastStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const info = alert.info?.[0]; // Usually VMA has one info block for the main language
  if (!info) return null;

  const areaDesc = info.area?.map(a => a.areaDesc).join(', ') || 'Sweden';
  const severityColor = info.severity === 'Severe' || info.severity === 'Extreme' 
    ? 'text-red-500 border-red-500/50 bg-red-950/20' 
    : 'text-amber-500 border-amber-500/50 bg-amber-950/20';

  // Determine styling based on Alert Status (Actual, Test, Exercise)
  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'actual':
        return 'bg-rose-500/20 text-rose-200 border-rose-500/50 shadow-[0_0_10px_rgba(225,29,72,0.2)]';
      case 'exercise':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
      case 'test':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/50';
      case 'system':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50';
      default:
        return 'bg-slate-700/50 text-slate-400 border-slate-600';
    }
  };

  const statusStyle = getStatusStyle(alert.status);

  const handleSend = async () => {
    setIsSending(true);
    setLastStatus('idle');
    
    // Format message for radio (limit length if needed, but modern Meshtastic handles ~230 bytes)
    const radioMessage = `VMA [${alert.status.toUpperCase()}]: ${info.headline} - ${info.description.substring(0, 160)}${info.description.length > 160 ? '...' : ''}`;
    
    try {
      await onBroadcast(radioMessage);
      setLastStatus('success');
      setTimeout(() => setLastStatus('idle'), 3000);
    } catch (e) {
      setLastStatus('error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={`rounded-xl border ${severityColor} p-5 relative overflow-hidden transition-all hover:bg-slate-800/50`}>
      <div className="flex flex-col md:flex-row justify-between gap-4">
        
        {/* Content */}
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {/* Status Badge */}
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border tracking-wider ${statusStyle}`}>
              {alert.status}
            </span>

            {/* Severity Badge */}
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${severityColor}`}>
              {info.severity}
            </span>

            <span className="text-slate-400 text-xs flex items-center gap-1 ml-1">
              <MapPin size={12} />
              {areaDesc}
            </span>
            <span className="text-slate-500 text-xs border-l border-slate-700 pl-2 ml-1">
              {new Date(alert.sent).toLocaleString()}
            </span>
          </div>

          <h3 className="text-xl font-bold text-white leading-tight">
            {info.headline}
          </h3>
          
          <p className="text-slate-300 text-sm leading-relaxed border-l-2 border-slate-700 pl-3">
            {info.description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col justify-center items-end min-w-[140px] gap-2">
          <button
            onClick={handleSend}
            disabled={isSending}
            className={`
              w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all
              ${lastStatus === 'success' 
                ? 'bg-green-600 text-white' 
                : lastStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-900/20'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {isSending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Sending...
              </>
            ) : lastStatus === 'success' ? (
              <>
                <Check size={16} />
                Sent!
              </>
            ) : lastStatus === 'error' ? (
              <>
                <AlertOctagon size={16} />
                Failed
              </>
            ) : (
              <>
                <Radio size={16} />
                Broadcast
              </>
            )}
          </button>
          
          <div className="text-[10px] text-slate-500 text-center w-full">
            To Meshtastic Broadcast
          </div>
        </div>
      </div>
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

export default AlertCard;