/**
 * TypeScript type definitions for SIP protocol
 */

/**
 * SIP device information
 */
export interface SipDeviceInfo {
  userAgent?: string | null;
  server?: string | null;
  allow?: string | null;
  supported?: string | null;
  statusCode?: number | null;
  statusText?: string | null;
  vendor?: string;
  model?: string;
  version?: string;
}

/**
 * Parsed SIP response
 */
export interface SipResponse {
  deviceInfo: SipDeviceInfo;
  headers: Record<string, string>;
  statusLine: string;
}

/**
 * SIP discovery options
 */
export interface SipDiscoveryOptions {
  timeout?: number;
  [key: string]: unknown;
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
 * SIP post-processor options
 */
export interface SipOptions {
  timeout?: number;
  [key: string]: unknown;
}
