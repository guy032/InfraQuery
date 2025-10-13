/**
 * Device Registry Module
 *
 * Maintains a registry of discovered devices and their characteristics
 * Used for cross-protocol coordination (e.g., skipping printer port 9100)
 */

import type { DeviceInfo, RegistryStats } from './types';

export class DeviceRegistry {
  devices: Map<string, DeviceInfo>;

  constructor() {
    // Map of IP -> device info
    this.devices = new Map();
  }

  /**
   * Register a device with its characteristics
   */
  registerDevice(ip: string, info: Partial<DeviceInfo>): void {
    const existing = this.devices.get(ip) || {};

    this.devices.set(ip, {
      ...existing,
      ...info,
      lastUpdated: Date.now(),
    });
  }

  /**
   * Mark a device as a printer
   */
  markAsPrinter(ip: string, source: string, details: Record<string, unknown> = {}): void {
    const existing = this.devices.get(ip) || {};

    this.devices.set(ip, {
      ...existing,
      isPrinter: true,
      printerDetectedBy: source,
      printerDetails: details,
      lastUpdated: Date.now(),
    });

    // console.log(`🖨️  Device ${ip} marked as printer by ${source}`);
  }

  /**
   * Check if a device is a printer
   */
  isPrinter(ip: string): boolean {
    const device = this.devices.get(ip);

    return device?.isPrinter === true;
  }

  /**
   * Check if port 9100 should be skipped for a device
   */
  shouldSkipPort9100(ip: string): boolean {
    return this.isPrinter(ip);
  }

  /**
   * Get device information
   */
  getDevice(ip: string): DeviceInfo | null {
    return this.devices.get(ip) || null;
  }

  /**
   * Clear all devices
   */
  clear(): void {
    this.devices.clear();
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const printers = [...this.devices.values()].filter((d) => d.isPrinter).length;

    return {
      totalDevices: this.devices.size,
      printers,
      nonPrinters: this.devices.size - printers,
    };
  }
}

// Singleton instance
export const deviceRegistry = new DeviceRegistry();
