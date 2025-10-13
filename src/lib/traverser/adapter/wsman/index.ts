/**
 * WinRM Protocol Extension
 *
 * Provides WinRM service detection and Windows device identification capabilities.
 *
 * Features:
 * - WinRM service detection (HTTP/HTTPS)
 * - Windows OS version identification from NTLM
 * - Computer name and domain extraction
 * - FQDN and NetBIOS name resolution
 */

import type { WinRMDeviceMetadata, WinRMDiscoveryOptions, WinRMTelegrafMetric } from './types';
import { WinRMDiscovery } from './wsman';

/**
 * WinRM discovery function for network scanner
 * @param {string} agent - Target IP address
 * @param {number} port - WinRM port (default 5985 for HTTP, 5986 for HTTPS)
 * @param {Object} options - Discovery options
 * @returns {Promise<Array>} Array of metrics in Telegraf JSON format
 */
async function discover(
  agent: string,
  port = 5985,
  options: WinRMDiscoveryOptions = {},
): Promise<WinRMTelegrafMetric[]> {
  const { timeout = 1000 } = options; // TURBO MODE: 1 second timeout (reduced from 5s)

  try {
    const winrmDiscovery = new WinRMDiscovery(agent, port);
    winrmDiscovery.WINRM_TIMEOUT = timeout;

    const deviceInfo = await winrmDiscovery.discover();

    if (!deviceInfo || !deviceInfo.winrmEnabled) {
      return [];
    }

    // Build device metadata
    const deviceMetadata: WinRMDeviceMetadata = {
      type: 'computer',
      role: 'server',
      vendor: deviceInfo.vendor || 'Microsoft',
      description: deviceInfo.description || 'Windows Computer',
      hostname: deviceInfo.hostname || undefined,

      // WinRM-specific information
      winrm: {
        enabled: true,
        port: deviceInfo.winrmPort,
        protocol: deviceInfo.winrmProtocol,
      },

      // OS information
      os: deviceInfo.os || 'Windows',
      osVersion: deviceInfo.osVersion || undefined,
      osBuild: deviceInfo.osBuild || undefined,

      // Network naming
      fqdn: deviceInfo.fqdn || undefined,
      netbiosComputerName: deviceInfo.netbiosComputerName || undefined,
      netbiosDomainName: deviceInfo.netbiosDomainName || undefined,
      dnsDomainName: deviceInfo.dnsDomainName || undefined,
      dnsTreeName: deviceInfo.dnsTreeName || undefined,
    };

    // Return metrics in Telegraf JSON format
    return [
      {
        fields: {
          // Operational metrics
          available: 1,
          winrm_service: 1,
          build_number: deviceInfo.osBuild ? Number.parseInt(deviceInfo.osBuild, 10) : 0,
        },
        name: 'winrm',
        tags: {
          agent,
          protocol: 'winrm',
          port: String(port),
          os: deviceInfo.osVersion || 'Windows',
          hostname: deviceInfo.hostname || agent,
          transport: deviceInfo.winrmProtocol || 'http',
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
export type {
  WinRMDeviceInfo,
  WinRMDeviceMetadata,
  WinRMDiscoveryOptions,
  WinRMTelegrafMetric,
} from './types';
export { WinRMDiscovery } from './wsman';
