export interface HeaderKpi {
  label: string;
  value: string;
  tone?: 'neutral' | 'alert' | 'good';
}

export const headerKpis: HeaderKpi[] = [
  { label: 'Applications Today', value: '248' },
  { label: 'Currently Flagged', value: '53', tone: 'alert' },
  { label: 'In Review', value: '18' },
  { label: 'Fraud Rate', value: '8.7%', tone: 'alert' },
];

export const fraudRateSparkline = [
  { day: 'Mon', value: 6.8 },
  { day: 'Tue', value: 7.1 },
  { day: 'Wed', value: 6.5 },
  { day: 'Thu', value: 7.9 },
  { day: 'Fri', value: 8.7 },
];
