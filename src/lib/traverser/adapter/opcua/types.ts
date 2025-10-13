/**
 * TypeScript type definitions for OPC-UA protocol
 */

/**
 * OPC-UA device identification information
 */
export interface OpcUaDeviceInfo {
  productName: string | null;
  manufacturerName: string | null;
  softwareVersion: string | null;
  buildNumber: string | null;
  deviceType: string;
  serverIdentity: string | null;
  startTime: Date | null;
  currentTime: Date | null;
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
 * OPC-UA post-processor options
 */
export type OpcUaOptions = Record<string, unknown>;

/**
 * OPC-UA scan options for discovery
 */
export interface OpcUaScanOptions {
  port?: number;
  timeout?: number;
  securityMode?: string;
  securityPolicy?: string;
  authMethod?: string;
}

/**
 * Write function type for stdout/stderr
 */
export type WriteFunction = (
  chunk: string | Uint8Array,
  encoding?: BufferEncoding | ((error?: Error | null) => void),
  callback?: (error?: Error | null) => void,
) => boolean;
