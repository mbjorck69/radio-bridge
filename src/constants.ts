import { AppConfig } from './types';

export const DEFAULT_CONFIG: AppConfig = {
  connectionMode: 'http',
  meshtasticIp: '192.168.1.10',
  meshtasticChannelIndex: 0,
  corsProxy: '',
  srApiUrl: 'https://vmaapi.sr.se/api/v2/alerts',
};

// Mock data to display if API fetch fails (demo mode)
export const MOCK_ALERTS = [
  {
    identifier: 'mock-1',
    msgType: 'Alert',
    scope: 'Public',
    status: 'Actual',
    sent: new Date().toISOString(),
    info: [{
      language: 'sv-SE',
      category: ['Safety'],
      event: 'Fire',
      headline: 'VMA: Kraftig rökutveckling i centrala Göteborg',
      description: 'Det brinner i en industrifastighet med kraftig rökutveckling som följd. Räddningsledaren uppmanar alla i området att gå inomhus, stänga dörrar, fönster och ventilation.',
      urgency: 'Immediate',
      severity: 'Severe',
      area: [{ areaDesc: 'Göteborgs kommun' }]
    }]
  }
];
