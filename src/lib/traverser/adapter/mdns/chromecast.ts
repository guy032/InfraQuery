/**
 * Chromecast mDNS service parser and direct connection
 */

import http from 'http';
import https from 'https';

import type { ChromecastResult, ChromecastTxtData, ServiceConfig } from './types';

/**
 * Chromecast-specific data parsing from mDNS TXT records
 */
export function parseChromecastServiceData(txtData: Record<string, string>): ChromecastTxtData {
  return {
    id: txtData.id || '',
    md: txtData.md || '', // Model
    fn: txtData.fn || '', // Friendly name
    rs: txtData.rs || '', // Receiver state
    bs: txtData.bs || '', // Boot state
    st: txtData.st || '', // Setup state
    ca: txtData.ca || '', // Capabilities
    ic: txtData.ic || '', // Icon path
  };
}

/**
 * Query Chromecast device directly via HTTP/HTTPS
 */
function queryChromecastPort(
  targetIp: string,
  port: number,
  protocol: 'http' | 'https',
): Promise<ChromecastResult> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions & https.RequestOptions = {
      hostname: targetIp,
      port,
      path: '/setup/eureka_info?options=detail',
      method: 'GET',
      timeout: 1000, // 1 second timeout (optimized for speed)
      rejectUnauthorized: false, // For HTTPS
      headers: {
        'User-Agent': 'Node.js Chromecast Client',
        // eslint-disable-next-line quote-props
        Accept: '*/*',
      },
    };

    const httpModule = protocol === 'https' ? https : http;
    const req = httpModule.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(responseData);

          resolve({
            chromecast: {
              services: {
                [`${port}/tcp chromecast`]: {
                  Name: jsonData.name || undefined,
                  Address: targetIp,
                  Port: port,
                  Model: jsonData.model_name || '',
                  Manufacturer: jsonData.manufacturer || '',
                  Version: jsonData.build_version || '',
                  MacAddress: jsonData.mac_address || undefined,
                  DeviceId: jsonData.ssdp_udn || undefined,
                },
              },
            },
            serviceType: 'chromecast',
          });
        } catch {
          reject(new Error('Failed to parse Chromecast response'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`${protocol.toUpperCase()} request timeout on port ${port}`));
    });

    req.end();
  });
}

/**
 * Try to connect to Chromecast on both HTTP and HTTPS ports
 */
export async function queryChromecastDirect(targetIp: string): Promise<ChromecastResult> {
  const ports: Array<[number, 'http' | 'https']> = [
    [8008, 'http'],
    [8443, 'https'],
  ];

  for (const [port, protocol] of ports) {
    try {
      return await queryChromecastPort(targetIp, port, protocol);
    } catch {
      // Continue to next port/protocol
    }
  }

  throw new Error('All Chromecast direct connection methods failed');
}

/**
 * Chromecast service configuration
 */
export const CHROMECAST_SERVICE: ServiceConfig = {
  query: '_googlecast._tcp.local',
  defaultPort: 8443,
  directConnection: queryChromecastDirect,
};
