/**
 * HTTP/HTTPS Protocol Discovery Implementation
 *
 * Collects raw HTTP/HTTPS response data without interpretation.
 */

import { deviceRegistry } from '../../lib/discovery/device-registry';
import HTTPDiscovery from './http';
import type { HTTPDeviceInfo, HTTPDiscoveryOptions } from './types';

/**
 * HTTP/HTTPS discovery function for network scanner
 * @param {string} agent - Target IP address
 * @param {number} port - HTTP/HTTPS port (default 80 for HTTP, 443 for HTTPS)
 * @param {HTTPDiscoveryOptions} options - Discovery options
 * @returns {Promise<Array>} Array of metrics in Telegraf JSON format
 */
export async function discover(agent: string, port = 80, options: HTTPDiscoveryOptions = {}) {
  const { timeout = 1000 } = options; // TURBO MODE: 1 second timeout (reduced from 5s)

  // Safety check: Skip port 9100 if device is a known printer
  if (port === 9100 && deviceRegistry.shouldSkipPort9100(agent)) {
    // console.log(`🖨️  Skipping port 9100 for ${agent} - device is a printer (would send data to print queue)`);
    return []; // Return empty metrics for printers on port 9100
  }

  try {
    const httpDiscovery = new HTTPDiscovery(agent, port);
    httpDiscovery.HTTP_TIMEOUT = timeout;

    const deviceInfo: HTTPDeviceInfo = await httpDiscovery.discover();

    if (!deviceInfo || !deviceInfo.httpEnabled) {
      return [];
    }

    // Build device metadata with raw HTTP data only
    // Use transport-specific key to allow multiple HTTP/HTTPS info blocks
    const transportKey = deviceInfo.httpProtocol || 'http'; // 'http' or 'https'
    const deviceMetadata = {
      type: 'server',
      transport: transportKey,
      port: deviceInfo.httpPort,

      // HTTP response information
      statusCode: deviceInfo.statusCode,
      statusMessage: deviceInfo.statusMessage,

      // Raw headers
      server: deviceInfo.server || undefined,
      contentType: deviceInfo.contentType || undefined,
      poweredBy: deviceInfo.poweredBy || undefined,
      aspnetVersion: deviceInfo.aspnetVersion || undefined,
      generator: deviceInfo.generator || undefined,

      // All headers for reference
      headers: deviceInfo.headers || {},

      // Raw body content
      body: deviceInfo.body,

      // SSL certificate info (if HTTPS)
      ssl: deviceInfo.ssl || undefined,
    };

    // Return metrics in Telegraf JSON format
    return [
      {
        fields: {
          // Operational metrics
          available: 1,
          http_service: 1,
          status_code: deviceInfo.statusCode || 0,
          response_time: 0, // Could be enhanced with timing
        },
        name: 'http',
        tags: {
          agent,
          protocol: 'http',
          port: String(port),
          transport: transportKey,
          status_code: String(deviceInfo.statusCode || 0),
          server: deviceInfo.server || 'unknown',
          // Device identification metadata in special _device_info tag
          // Use transport-specific key to differentiate HTTP from HTTPS
          [`_device_info_${transportKey}`]: JSON.stringify(deviceMetadata),
          _device_info: JSON.stringify(deviceMetadata), // Keep this for backwards compatibility
        },
        timestamp: Math.floor(Date.now() / 1000),
      },
    ];
  } catch {
    // Return empty array on error (fail silently)
    return [];
  }
}
