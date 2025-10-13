/**
 * TypeScript type definitions for CIP/EtherNet-IP protocol
 */

/**
 * CIP device identification information
 */
export interface CipDeviceInfo {
  productName: string | null;
  vendorID: number | null;
  vendorName: string | null;
  deviceTypeID: number | null;
  deviceType: string;
  productCode: number | null;
  serialNumber: string | null;
  serialNumberDecimal: number | null;
  version: string | null;
  slot?: number;
  status?: number;
  faulted?: boolean;
  ipAddress: string;
  port: number;
  transportProtocol: 'TCP' | 'UDP' | 'Both';
}

/**
 * CIP scan options for discovery
 */
export interface CipScanOptions {
  port?: number;
  timeout?: number;
  slot?: number;
  testBoth?: boolean;
}

/**
 * CIP discovery result
 */
export interface CipDiscoveryResult {
  available: boolean;
  deviceInfo?: CipDeviceInfo;
  port: number;
  protocol: 'TCP' | 'UDP' | 'Both';
}

/**
 * Telegraf metric format
 */
export interface TelegrafMetric {
  name: string;
  fields: Record<string, number | string>;
  tags: Record<string, string>;
  timestamp: number;
}

/**
 * CIP post-processor options
 */
export type CipOptions = Record<string, unknown>;
