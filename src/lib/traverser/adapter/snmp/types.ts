/**
 * TypeScript type definitions for SNMP protocol
 */

/**
 * SNMP varbind (variable binding)
 */
export interface SnmpVarbind {
  oid: string;
  type: number;
  value: any;
}

/**
 * SNMP session options for v1/v2c
 */
export interface SnmpSessionOptions {
  port: number;
  retries: number;
  timeout: number;
  version: number;
}

/**
 * SNMP v3 profile
 */
export interface SnmpV3Profile {
  user: string;
  authProtocol?: number;
  authKey?: string;
  privProtocol?: number;
  privKey?: string;
}

/**
 * SNMP v3 session options
 */
export interface SnmpV3SessionOptions extends SnmpSessionOptions {
  user: string;
  authProtocol?: number;
  authKey?: string;
  privProtocol?: number;
  privKey?: string;
}

/**
 * SNMP test result
 */
export interface SnmpTestResult {
  success: boolean;
  error?: string;
  varbind?: {
    oid: string;
    type: number;
    value: string;
  };
  bulkCount?: number;
}

/**
 * Vendor detection result
 */
export interface VendorInfo {
  id: string;
  name: string;
  sysObjectID: string;
}

/**
 * Vendor pattern
 */
export interface VendorPattern {
  pattern: RegExp;
  name: string;
}

/**
 * Printer detection details
 */
export interface PrinterDetails {
  detectionMethod?: string;
  vendor?: string;
  sysObjectID?: string;
  sysDescr?: string;
}

/**
 * Telegraf metric format
 */
export interface TelegrafMetric {
  name: string;
  fields: Record<string, any>;
  tags: Record<string, string>;
  timestamp: number;
}

/**
 * SNMP post-processor options
 */
export interface SnmpOptions {
  community?: string;
  version?: string;
  timeout?: number;
  retries?: number;
  [key: string]: unknown;
}

/**
 * SNMP session interface (from net-snmp)
 */
export interface SnmpSession {
  get(oids: string[], callback: (error: Error | null, varbinds: any[]) => void): void;
  getNext(oids: string[], callback: (error: Error | null, varbinds: any[]) => void): void;
  getBulk(
    oids: string[],
    nonRepeaters: number,
    maxRepetitions: number,
    callback: (error: Error | null, varbinds: any[]) => void,
  ): void;
  subtree(
    oid: string,
    maxRepetitions: number,
    onVarbinds: (varbinds: any[]) => void,
    onComplete: (error: Error | null) => void,
  ): void;
  close(): void;
}

/**
 * OID prefix entry from configuration
 */
export interface OidPrefixEntry {
  oid: string;
  description?: string;
}

/**
 * OID prefixes configuration
 */
export interface OidPrefixesConfig {
  oid_prefixes: OidPrefixEntry[];
}

/**
 * SNMPv3 discovery result
 */
export interface ISnmpV3DiscoveryResult {
  success: boolean;
  enterprise?: number;
  enterpriseName?: string;
  engineIDFormat?: string;
  engineIDData?: string;
  engineBoots?: number;
  engineTime?: number;
  engineTimeFormatted?: string;
  raw?: string;
  error?: string;
}
