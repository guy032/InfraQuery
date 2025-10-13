/**
 * Modbus Discovery Module
 * Native implementation for discovering Modbus TCP devices
 */

import log from '../../lib/infrastructure/logger';
import { ModbusTCP } from './modbus';
import type { ModbusDeviceInfo, ModbusDiscoveryResult, ModbusScanOptions } from './types';

/**
 * Modbus discovery function for network scanner (main entry point)
 * @param {string} agent - Target IP address
 * @param {number} port - Modbus port (default 502)
 * @param {ModbusScanOptions} options - Discovery options
 * @returns {Promise<Array>} Array of metrics in Telegraf JSON format
 */
export async function discover(
  agent: string,
  port = 502,
  options: ModbusScanOptions = {},
): Promise<unknown[]> {
  const { unitId = 1, timeout = 2000, detectRegisters = false, maxRegisters = 10 } = options;

  try {
    // Create Modbus client
    const modbus = new ModbusTCP(agent, port, timeout);

    // Perform discovery
    const result: ModbusDiscoveryResult = await modbus.discover({
      unitId,
      timeout,
      port,
      detectRegisters,
      maxRegisters,
    });

    if (!result.available || !result.deviceInfo) {
      return [];
    }

    const deviceInfo = result.deviceInfo;

    // Build device metadata
    const deviceMetadata = {
      type: 'plc',
      vendor: deviceInfo.vendor || 'Unknown',
      role: 'modbus_device',
      port: result.port,
      unitId: result.unitId,

      // Device identification
      product: deviceInfo.product || undefined,
      version: deviceInfo.version || undefined,
      vendorUrl: deviceInfo.vendorUrl || undefined,
      productName: deviceInfo.productName || undefined,
      modelName: deviceInfo.modelName || undefined,

      // Raw device info for reference
      rawInfo: deviceInfo,
    };

    // Build field values
    const fields: Record<string, number | string | boolean> = {
      available: 1,
      modbus_service: 1,
      unitId: result.unitId,
      port: result.port,
    };

    // Add optional fields if available
    if (deviceInfo.vendor) {
      fields.vendor = deviceInfo.vendor;
    }

    if (deviceInfo.product) {
      fields.product = deviceInfo.product;
    }

    if (deviceInfo.version) {
      fields.version = deviceInfo.version;
    }

    if (deviceInfo.productName) {
      fields.product_name = deviceInfo.productName;
    }

    if (deviceInfo.modelName) {
      fields.model_name = deviceInfo.modelName;
    }

    // Add register values if available
    if (result.registers && result.registers.length > 0) {
      for (const register of result.registers) {
        const fieldName = `${register.type}_${register.address}[type=${register.type === 'holding' ? 'holding_register' : register.type === 'input' ? 'input_register' : register.type === 'coil' ? 'coil' : 'discrete_input'}]`;
        fields[fieldName] = register.value;
      }
    }

    // Return metrics in Telegraf JSON format
    return [
      {
        fields,
        name: 'modbus',
        tags: {
          agent,
          protocol: 'modbus',
          port: String(port),
          unitId: String(result.unitId),
          vendor: deviceInfo.vendor || 'unknown',
          // Device identification metadata
          _device_info: JSON.stringify(deviceMetadata),
        },
        timestamp: Math.floor(Date.now() / 1000),
      },
    ];
  } catch (error) {
    const err = error as Error;
    log.debug(`Modbus discovery failed for ${agent}:${port} - ${err.message}`);

    // Return empty array on error (fail silently)
    return [];
  }
}

/**
 * Discover Modbus device at given IP
 */
export async function discoverModbusDevice(
  ip: string,
  options: ModbusScanOptions = {},
): Promise<ModbusDeviceInfo | null> {
  const { unitId = 1, timeout = 2000, port = 502 } = options;

  log.verbose(`Scanning Modbus device at ${ip}:${port} (Unit ID: ${unitId})`);

  try {
    const modbus = new ModbusTCP(ip, port, timeout);
    const result = await modbus.discover({ unitId, timeout, port });

    if (result.available && result.deviceInfo) {
      log.verbose(
        `✓ Found Modbus device: ${result.deviceInfo.vendor || 'Unknown'} ${result.deviceInfo.product || 'Unknown'}`,
      );

      return result.deviceInfo;
    }

    log.verbose(`✗ No Modbus device found at ${ip}:${port}`);

    return null;
  } catch (error) {
    log.verbose(`Modbus discovery failed: ${error.message}`);

    return null;
  }
}

/**
 * Try multiple unit IDs to find responsive Modbus device
 */
export async function discoverModbusDeviceMultiUnit(
  ip: string,
  options: ModbusScanOptions = {},
): Promise<ModbusDeviceInfo | null> {
  const { timeout = 2000, port = 502 } = options;

  // Try common unit IDs (1 is most common, then 0, 255)
  const unitIdsToTry = [1, 0, 255, 2, 3];

  for (const unitId of unitIdsToTry) {
    try {
      const deviceInfo = await discoverModbusDevice(ip, { unitId, timeout, port });

      if (deviceInfo) {
        return deviceInfo;
      }
    } catch {
      // Try next unit ID
    }
  }

  return null;
}
