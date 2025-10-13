/**
 * DNS Query Protocol Types
 */

export interface DnsQueryOptions {
  domains?: string[];
  recordType?: string;
  timeout?: number;
  network?: 'udp' | 'tcp';
}

export interface DnsQueryResult {
  domain: string;
  server: string;
  recordType: string;
  queryTimeMs: number;
  resultCode: string;
  rcodeValue: number;
  answers: string[];
  error?: string;
}

export interface DnsDeviceMetadata {
  type: string;
  role: string;
  available: boolean;
  dnsServer: boolean;
  responseTime?: number;
  hostname?: string;
}

export interface TelegrafMetric {
  name: string;
  timestamp: number;
  tags: Record<string, string>;
  fields: Record<string, number>;
}
