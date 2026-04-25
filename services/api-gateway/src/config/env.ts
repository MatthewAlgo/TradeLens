export interface GatewayEnv {
  port: number;
  brokers: string[];
  timescaleDsn: string;
  omsUrl: string;
  backtesterUrl: string;
}

export function parseBrokers(raw: string | undefined): string[] {
  return (raw || 'localhost:19092')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function loadEnv(): GatewayEnv {
  return {
    port: parseInt(process.env.PORT || '4000', 10),
    brokers: parseBrokers(process.env.REDPANDA_BROKERS),
    timescaleDsn: process.env.TIMESCALE_DSN || 'postgres://tradelens:tradelens_secret@localhost:5432/market_data',
    omsUrl: process.env.OMS_URL || 'http://localhost:4001',
    backtesterUrl: process.env.BACKTESTER_URL || 'http://localhost:8000',
  };
}
