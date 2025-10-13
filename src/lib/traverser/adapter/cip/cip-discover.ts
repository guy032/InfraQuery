/**
 * CIP Discovery Module
 * Native implementation for discovering CIP/EtherNet-IP devices
 */

import log from '../../lib/infrastructure/logger';
import { CipClient } from './cip';
import type { CipDeviceInfo, CipScanOptions } from './types';

/**
 * CIP discovery function for network scanner (main entry point)
 * @param {string} agent - Target IP address
 * @param {number} port - CIP port (default 44818)
 * @param {CipScanOptions} options - Discovery options
 * @returns {Promise<Array>} Array of metrics in Telegraf JSON format
 */
export async function discover(
  agent: string,
  port = 44_818,
  options: CipScanOptions = {},
): Promise<unknown[]> {
  try {
    // Create CIP client
    const cip = new CipClient(agent, port, options.timeout || 10_000);

    // Perform discovery
    const deviceInfo: CipDeviceInfo | null = await cip.discover(options);

    if (!deviceInfo) {
      return [];
    }

    // Build device metadata
    const deviceMetadata = {
      type: 'plc',
      vendor: deviceInfo.vendorName || 'Unknown',
      role: 'cip_device',
      port,

      // Device identification
      product: deviceInfo.productName || undefined,
      productCode: deviceInfo.productCode || undefined,
      serialNumber: deviceInfo.serialNumber || undefined,
      version: deviceInfo.version || undefined,
      deviceType: deviceInfo.deviceType || undefined,
      slot: deviceInfo.slot || undefined,
      transportProtocol: deviceInfo.transportProtocol,

      // Raw device info for reference
      rawInfo: deviceInfo,
    };

    // Build field values
    const fields: Record<string, number | string> = {
      available: 1,
      cip_service: 1,
      port,
    };

    // Add optional fields if available
    if (deviceInfo.vendorName) {
      fields.vendor = deviceInfo.vendorName;
    }

    if (deviceInfo.vendorID !== null) {
      fields.vendor_id = deviceInfo.vendorID;
    }

    if (deviceInfo.productName) {
      fields.product = deviceInfo.productName;
    }

    if (deviceInfo.productCode !== null) {
      fields.product_code = deviceInfo.productCode;
    }

    if (deviceInfo.serialNumber) {
      fields.serial_number = deviceInfo.serialNumber;
    }

    if (deviceInfo.version) {
      fields.version = deviceInfo.version;
    }

    if (deviceInfo.deviceType) {
      fields.device_type = deviceInfo.deviceType;
    }

    if (deviceInfo.deviceTypeID !== null) {
      fields.device_type_id = deviceInfo.deviceTypeID;
    }

    if (deviceInfo.slot !== undefined) {
      fields.slot = deviceInfo.slot;
    }

    // Return metrics in Telegraf JSON format
    return [
      {
        fields,
        name: 'cip',
        tags: {
          agent,
          protocol: 'cip',
          port: String(port),
          vendor: deviceInfo.vendorName || 'unknown',
          transport: deviceInfo.transportProtocol,
          // Device identification metadata
          _device_info: JSON.stringify(deviceMetadata),
        },
        timestamp: Math.floor(Date.now() / 1000),
      },
    ];
  } catch (error) {
    const err = error as Error;
    log.debug(`CIP discovery failed for ${agent}:${port} - ${err.message}`);

    // Return empty array on error (fail silently)
    return [];
  }
}

/**
 * Discover CIP device at given IP
 */
export async function discoverCipDevice(
  ip: string,
  port = 44_818,
  options: CipScanOptions = {},
): Promise<CipDeviceInfo | null> {
  log.verbose(`Scanning CIP device at ${ip}:${port}`);

  try {
    const cip = new CipClient(ip, port, options.timeout || 10_000);
    const deviceInfo = await cip.discover(options);

    if (deviceInfo) {
      log.verbose(
        `✓ Found CIP device: ${deviceInfo.vendorName || 'Unknown'} ${deviceInfo.productName || 'Unknown'}`,
      );

      return deviceInfo;
    }

    log.verbose(`✗ No CIP device found at ${ip}:${port}`);

    return null;
  } catch (error) {
    log.verbose(`CIP discovery failed: ${error.message}`);

    return null;
  }
}
