/**
 * SSDP Protocol Module
 * Handles SSDP message creation and device location discovery
 */

import dgram from 'dgram';
import url from 'url';

/**
 * Create SSDP M-SEARCH discovery message
 * For unicast discovery, HOST should be the target IP, not multicast address
 */
export function createSsdpMessage(ip: string, port: number): string {
  const multicastHost = '239.255.255.250:1900';

  return [
    'M-SEARCH * HTTP/1.1',
    `HOST: ${multicastHost}`,
    'MAN: "ssdp:discover"',
    'MX: 3',
    'ST: ssdp:all',
    'USER-AGENT: NodeJS/UPnPClient UNICAST/1.0',
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
    const ssdpMessage = createSsdpMessage(ip, port);
    let maxTimeoutHandle: NodeJS.Timeout | null = null;
    let debounceTimeoutHandle: NodeJS.Timeout | null = null;
    let socketClosed = false;
    
    // Debounce delay: resolve if no new messages for this duration
    const DEBOUNCE_MS = 500;

    // Helper to safely close socket
    const safeClose = () => {
      if (!socketClosed) {
        socketClosed = true;

        if (maxTimeoutHandle) {
          clearTimeout(maxTimeoutHandle);
          maxTimeoutHandle = null;
        }
        
        if (debounceTimeoutHandle) {
          clearTimeout(debounceTimeoutHandle);
          debounceTimeoutHandle = null;
        }

        try {
          socket.close();
        } catch {
          // Socket already closed, ignore
        }
      }
    };
    
    // Helper to finish discovery
    const finishDiscovery = () => {
      safeClose();
      console.log(`[UPNP] Discovery complete. Found ${locations.size} unique location(s)`);
      resolve(locations);
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
          
          // Reset debounce timer - finish if no new messages for DEBOUNCE_MS
          if (debounceTimeoutHandle) {
            clearTimeout(debounceTimeoutHandle);
          }
          debounceTimeoutHandle = setTimeout(finishDiscovery, DEBOUNCE_MS);
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

    // Maximum timeout - finish regardless of activity
    maxTimeoutHandle = setTimeout(finishDiscovery, timeout);
  });
}
