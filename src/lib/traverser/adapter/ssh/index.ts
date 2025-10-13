/**
 * SSH Protocol Extension
 *
 * Provides SSH banner detection and device identification capabilities.
 *
 * Features:
 * - SSH service detection
 * - SSH version identification (OpenSSH, Dropbear, libssh)
 * - OS detection from SSH banners (Ubuntu, Debian, CentOS, etc.)
 * - SSH software version extraction
 */

import { SSHDiscovery } from './ssh';
import type { SSHDeviceMetadata, SSHDiscoveryOptions, SSHTelegrafMetric } from './types';

/**
 * SSH discovery function for network scanner
 * @param {string} agent - Target IP address
 * @param {number} port - SSH port (default 22)
 * @param {Object} options - Discovery options
 * @returns {Promise<Array>} Array of metrics in Telegraf JSON format
 */
async function discover(
  agent: string,
  port = 22,
  options: SSHDiscoveryOptions = {},
): Promise<SSHTelegrafMetric[]> {
  const { timeout = 1000 } = options; // TURBO MODE: 1 second timeout (reduced from 5s)

  try {
    const sshDiscovery = new SSHDiscovery(agent, port);
    sshDiscovery.SSH_TIMEOUT = timeout;

    const deviceInfo = await sshDiscovery.discover();

    if (!deviceInfo || !deviceInfo.banner) {
      return [];
    }

    // Build device metadata
    const deviceMetadata: SSHDeviceMetadata = {
      type: 'computer',
      role: 'server',
      vendor: deviceInfo.vendor || undefined,
      description: deviceInfo.description || undefined,

      // SSH-specific information
      ssh: {
        protocol: deviceInfo.protocol || undefined,
        software: deviceInfo.software || undefined,
        version: deviceInfo.version || undefined,
        banner: deviceInfo.banner || undefined,
      },

      // OS information
      os: deviceInfo.osDistribution || deviceInfo.os || undefined,
      osVersion: deviceInfo.osVersion || undefined,
      osDistribution: deviceInfo.osDistribution || undefined,
    };

    // Return metrics in Telegraf JSON format
    return [
      {
        fields: {
          // Operational metrics
          available: 1,
          protocol_version: deviceInfo.protocol ? Number.parseFloat(deviceInfo.protocol) : 2,
          ssh_service: 1,
        },
        name: 'ssh',
        tags: {
          agent,
          protocol: 'ssh',
          port: String(port),
          ssh_software: deviceInfo.software || 'unknown',
          ssh_version: deviceInfo.version || 'unknown',
          os: deviceInfo.osDistribution || deviceInfo.os || 'unknown',
          // Device identification metadata in special _device_info tag
          _device_info: JSON.stringify(deviceMetadata),
        },
        timestamp: Math.floor(Date.now() / 1000),
      },
    ];
  } catch {
    // Return empty array on error (fail silently)
    return [];
  }
}

export { discover };
export { SSHDiscovery } from './ssh';
export type {
  SSHDeviceInfo,
  SSHDeviceMetadata,
  SSHDiscoveryOptions,
  SSHTelegrafMetric,
} from './types';
