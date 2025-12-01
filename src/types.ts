export interface SrAlert {
  identifier: string;
  msgType: string;
  scope: string;
  status: string;
  info?: SrAlertInfo[];
  sent: string;
}

export interface SrAlertInfo {
  language: string;
  category: string[];
  event: string;
  headline: string;
  description: string;
  instruction?: string;
  area?: SrAlertArea[];
  urgency: string;
  severity: string;
}

export interface SrAlertArea {
  areaDesc: string;
}

export type ConnectionMode = 'http' | 'serial';

export interface AppConfig {
  connectionMode: ConnectionMode;
  meshtasticIp: string;
  meshtasticChannelIndex: number; // usually 0
  corsProxy: string; // e.g. https://cors-anywhere.herokuapp.com/
  srApiUrl: string; // Default: https://vmaapi.sr.se/api/v2/alerts
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

// Minimal interface for Serial Port (Web Serial API)
export interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream | null;
  writable: WritableStream | null;
}
