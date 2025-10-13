/**
 * OPC UA Discovery Module
 * Native implementation for discovering OPC UA servers
 */

import net from 'net';

import log from '../../lib/infrastructure/logger';
import { OpcUaDeviceIdentification } from './opcua';
import type { OpcUaDeviceInfo, OpcUaScanOptions } from './types';

/**
 * Quick TCP port check to see if the port is open
 */
function checkTcpPort(host: string, port: number, timeout = 2000): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();

    const onError = () => {
      socket.destroy();
      reject(new Error(`Port ${port} is not reachable on ${host}`));
    };

    socket.setTimeout(timeout);
    socket.once('error', onError);
    socket.once('timeout', onError);

    socket.connect(port, host, () => {
      socket.destroy();
      resolve(true);
    });
  });
}

/**
 * OPC UA discovery function for network scanner (main entry point)
 * @param {string} agent - Target IP address
 * @param {number} port - OPC UA port (default 4840)
 * @param {OpcUaScanOptions} options - Discovery options
 * @returns {Promise<Array>} Array of metrics in Telegraf JSON format
 */
export async function discover(
  agent: string,
  port = 4840,
  options: OpcUaScanOptions = {},
): Promise<unknown[]> {
  try {
    // First, quickly check if the port is open (like the working example)
    try {
      await checkTcpPort(agent, port, 2000);
    } catch {
      log.debug(`OPC UA port ${port} not accessible on ${agent}`);

      return [];
    }

    // Create OPC UA client
    const opcua = new OpcUaDeviceIdentification(agent, port);

    // Get device information
    const deviceInfo: OpcUaDeviceInfo | null = await opcua.getDeviceInfo();

    if (!deviceInfo) {
      return [];
    }

    // Build device metadata
    const deviceMetadata = {
      type: 'opcua_server',
      manufacturer: deviceInfo.manufacturerName || 'Unknown',
      role: 'opcua_device',
      port,

      // Device identification
      product: deviceInfo.productName || undefined,
      softwareVersion: deviceInfo.softwareVersion || undefined,
      buildNumber: deviceInfo.buildNumber || undefined,
      deviceType: deviceInfo.deviceType || undefined,
      serverIdentity: deviceInfo.serverIdentity || undefined,
      startTime: deviceInfo.startTime ? deviceInfo.startTime.toISOString() : undefined,
      currentTime: deviceInfo.currentTime ? deviceInfo.currentTime.toISOString() : undefined,

      // Raw device info for reference
      rawInfo: deviceInfo,
    };

    // Build field values
    const fields: Record<string, number | string> = {
      available: 1,
      opcua_service: 1,
      port,
    };

    // Add optional fields if available
    if (deviceInfo.manufacturerName) {
      fields.manufacturer = deviceInfo.manufacturerName;
    }

    if (deviceInfo.productName) {
      fields.product = deviceInfo.productName;
    }

    if (deviceInfo.softwareVersion) {
      fields.software_version = deviceInfo.softwareVersion;
    }

    if (deviceInfo.buildNumber) {
      fields.build_number = deviceInfo.buildNumber;
    }

    if (deviceInfo.deviceType) {
      fields.device_type = deviceInfo.deviceType;
    }

    if (deviceInfo.serverIdentity) {
      fields.server_identity = deviceInfo.serverIdentity;
    }

    // Return metrics in Telegraf JSON format
    return [
      {
        fields,
        name: 'opcua',
        tags: {
          agent,
          protocol: 'opcua',
          port: String(port),
          manufacturer: deviceInfo.manufacturerName || 'unknown',
          // Device identification metadata
          _device_info: JSON.stringify(deviceMetadata),
        },
        timestamp: Math.floor(Date.now() / 1000),
      },
    ];
  } catch (error) {
    const err = error as Error;
    log.debug(`OPC UA discovery failed for ${agent}:${port} - ${err.message}`);

    // Return empty array on error (fail silently)
    return [];
  }
}

/**
 * Discover OPC UA server at given IP
 */
export async function discoverOpcUaServer(
  ip: string,
  port = 4840,
  options: OpcUaScanOptions = {},
): Promise<OpcUaDeviceInfo | null> {
  log.verbose(`Scanning OPC UA server at ${ip}:${port}`);

  try {
    const opcua = new OpcUaDeviceIdentification(ip, port);
    const deviceInfo = await opcua.getDeviceInfo();

    if (deviceInfo) {
      log.verbose(
        `✓ Found OPC UA server: ${deviceInfo.manufacturerName || 'Unknown'} ${deviceInfo.productName || 'Unknown'}`,
      );

      return deviceInfo;
    }

    log.verbose(`✗ No OPC UA server found at ${ip}:${port}`);

    return null;
  } catch (error) {
    log.verbose(`OPC UA discovery failed: ${error.message}`);

    return null;
  }
}
