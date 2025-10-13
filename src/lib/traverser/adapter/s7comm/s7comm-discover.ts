/**
 * S7comm Protocol Discovery Implementation
 *
 * Native JavaScript implementation for discovering Siemens S7 PLCs
 */

import log from '../../lib/infrastructure/logger';
import { S7CommScanner } from './s7comm';
import type { S7DeviceInfo, S7ScannerOptions } from './types';

/**
 * S7comm discovery function for network scanner
 * @param {string} agent - Target IP address
 * @param {number} port - S7comm port (default 102)
 * @param {S7ScannerOptions} options - Discovery options
 * @returns {Promise<Array>} Array of metrics in Telegraf JSON format
 */
export async function discover(
  agent: string,
  port = 102,
  options: S7ScannerOptions = {},
): Promise<unknown[]> {
  const { rack = 0, slot = 2, timeout = 5000, connectionType = 'PD' } = options;

  try {
    // Create scanner with options
    const scanner = new S7CommScanner(agent, port, {
      rack,
      slot,
      timeout,
      connectionType,
    });

    // Get device information
    const deviceInfo: S7DeviceInfo = await scanner.getDeviceInfo();

    if (!deviceInfo || !deviceInfo.available) {
      return [];
    }

    // Build device metadata with S7 information
    const deviceMetadata = {
      type: 'plc',
      vendor: 'Siemens',
      role: 's7_plc',
      port: deviceInfo.port,
      rack: deviceInfo.rack,
      slot: deviceInfo.slot,

      // Device identification
      cpuModel: deviceInfo.cpuModel || undefined,
      orderNumber: deviceInfo.orderNumber || undefined,
      serialNumber: deviceInfo.serialNumber || undefined,
      firmwareVersion: deviceInfo.firmwareVersion || undefined,
      protocol: deviceInfo.protocol || 'S7comm',

      // Raw device info for reference
      rawInfo: deviceInfo,
    };

    // Build field values
    const fields: Record<string, number | string> = {
      available: 1,
      s7comm_service: 1,
      rack: deviceInfo.rack,
      slot: deviceInfo.slot,
    };

    // Add optional fields if available
    if (deviceInfo.cpuModel) {
      fields.cpu_model = deviceInfo.cpuModel;
    }

    if (deviceInfo.orderNumber) {
      fields.order_number = deviceInfo.orderNumber;
    }

    if (deviceInfo.serialNumber) {
      fields.serial_number = deviceInfo.serialNumber;
    }

    if (deviceInfo.firmwareVersion) {
      fields.firmware_version = deviceInfo.firmwareVersion;
    }

    // Return metrics in Telegraf JSON format
    return [
      {
        fields,
        name: 's7comm',
        tags: {
          agent,
          protocol: 's7comm',
          port: String(port),
          rack: String(deviceInfo.rack),
          slot: String(deviceInfo.slot),
          vendor: 'Siemens',
          cpu_model: deviceInfo.cpuModel || 'unknown',
          // Device identification metadata
          _device_info: JSON.stringify(deviceMetadata),
        },
        timestamp: Math.floor(Date.now() / 1000),
      },
    ];
  } catch (error) {
    const err = error as Error;
    log.debug(`S7comm discovery failed for ${agent}:${port} - ${err.message}`);

    // Return empty array on error (fail silently)
    return [];
  }
}
