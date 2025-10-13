/**
 * Types for Device Registry
 */

export interface DeviceInfo {
  isPrinter?: boolean;
  printerDetectedBy?: string;
  printerDetails?: Record<string, unknown>;
  type?: string;
  vendor?: string;
  model?: string;
  lastUpdated?: number;
  [key: string]: unknown;
}

export interface RegistryStats {
  totalDevices: number;
  printers: number;
  nonPrinters: number;
}
