/**
 * SSDP Protocol Module
 * Handles SSDP message creation and device location discovery
 */

import dgram from 'dgram';
import url from 'url';
import { UDPProtocolDiscovery } from './index';

/**
 * Create SSDP M-SEARCH discovery message
 * For unicast discovery, HOST should be the target IP, not multicast address
 */
export function createSsdpMessage(): string {
  return [
    'M-SEARCH * HTTP/1.1',
    `HOST: 239.255.255.250:1900`,
    'MAN: "ssdp:discover"',
    'MX: 3',
    'ST: ssdp:all',
    'USER-AGENT: UNICAST',
    '',
    '',
  ].join('\r\n');
}

/**
 * Discover UPnP device locations via SSDP
 */
export async function discoverLocations(
  ip: string,
  port: number,
  timeout = 5000,
): Promise<Set<string>> {
  const locations = new Set<string>();
  const locationRegex = /location: *(.+)\r\n/i;

  return new Promise<Set<string>>((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const ssdpMessage = createSsdpMessage();
    let timeoutHandle: NodeJS.Timeout | null = null;
    let socketClosed = false;

    // Helper to safely close socket
    const safeClose = () => {
      if (!socketClosed) {
        socketClosed = true;

        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }

        try {
          socket.close();
        } catch {
          // Socket already closed, ignore
        }
      }
    };

    socket.on('message', (data, rinfo) => {
      if (rinfo.address === ip) {
        const locationMatch = locationRegex.exec(data.toString());

        if (locationMatch) {
          let locationUrl = locationMatch[1].trim();

          // Replace internal IP with target IP for remote access
          try {
            const parsedUrl = new url.URL(locationUrl);
            locationUrl = `${parsedUrl.protocol}//${ip}:${parsedUrl.port}${parsedUrl.pathname}${parsedUrl.search}`;
          } catch {
            // Keep original URL if parsing fails
          }

          locations.add(locationUrl);
        }
      }
    });

    socket.on('error', (err) => {
      safeClose();
      reject(err);
    });

    socket.on('listening', () => {
      socket.send(ssdpMessage, port, ip, (err) => {
        if (err) {
          safeClose();
          reject(err);
        }
      });
    });

    socket.bind();

    timeoutHandle = setTimeout(() => {
      safeClose();
      resolve(locations);
    }, timeout);
  });
}

/**
 * SSDP/UPnP Protocol Definition
 * Automatically registered for UDP extra scanning
 */
export const protocol: UDPProtocolDiscovery = {
  name: 'upnp',
  port: 1900,
  service: 'upnp',
  discover: async (ip: string, port: number, timeout: number) => {
    try {
      const locations = await discoverLocations(ip, port, timeout);
      
      if (locations.size > 0) {
        return {
          found: true,
          details: {
            locations: Array.from(locations)
          }
        };
      }
      return { found: false };
    } catch (error) {
      return { found: false };
    }
  }
};

