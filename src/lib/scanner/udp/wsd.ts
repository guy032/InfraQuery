/**
 * WS-Discovery (WSD) Protocol Module
 * Handles WS-Discovery message creation and device discovery
 * Used by devices like printers, scanners, and network cameras
 */

import dgram from 'dgram';
import { randomUUID } from 'crypto';
import { UDPProtocolDiscovery } from './index';

/**
 * Create WS-Discovery Probe message
 * This is a SOAP-based discovery request
 */
export function createWsdMessage(): string {
  const messageId = `urn:uuid:${randomUUID()}`;
  
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:wsd="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:wsdp="http://schemas.xmlsoap.org/ws/2006/02/devprof">',
    '  <soap:Header>',
    `    <wsa:MessageID>${messageId}</wsa:MessageID>`,
    '    <wsa:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>',
    '    <wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</wsa:Action>',
    '  </soap:Header>',
    '  <soap:Body>',
    '    <wsd:Probe>',
    '      <wsd:Types>wsdp:Device</wsd:Types>',
    '    </wsd:Probe>',
    '  </soap:Body>',
    '</soap:Envelope>',
    ''
  ].join('\r\n');
}

/**
 * Parse WS-Discovery response to extract device information
 * Handles various namespace prefixes (wsd, d, a, etc.)
 */
function parseWsdResponse(data: string): {
  xAddrs?: string[];
  types?: string[];
  scopes?: string[];
} {
  const result: {
    xAddrs?: string[];
    types?: string[];
    scopes?: string[];
  } = {};

  // Extract XAddrs (device endpoints) - handle multiple namespace prefixes
  const xAddrsMatch = data.match(/<(?:\w+:)?XAddrs>(.*?)<\/(?:\w+:)?XAddrs>/si);
  if (xAddrsMatch) {
    result.xAddrs = xAddrsMatch[1]
      .trim()
      .split(/\s+/)
      .filter(addr => addr.length > 0);
  }

  // Extract Types (device types) - handle multiple namespace prefixes
  const typesMatch = data.match(/<(?:\w+:)?Types>(.*?)<\/(?:\w+:)?Types>/si);
  if (typesMatch) {
    result.types = typesMatch[1]
      .trim()
      .split(/\s+/)
      .filter(type => type.length > 0)
      .map(type => {
        // Extract just the type name after the last colon
        const parts = type.split(':');
        return parts[parts.length - 1];
      });
  }

  // Extract Scopes (device metadata) - handle multiple namespace prefixes
  const scopesMatch = data.match(/<(?:\w+:)?Scopes[^>]*>(.*?)<\/(?:\w+:)?Scopes>/si);
  if (scopesMatch) {
    result.scopes = scopesMatch[1]
      .trim()
      .split(/\s+/)
      .filter(scope => scope.length > 0);
  }

  return result;
}

/**
 * Discover WS-Discovery devices
 * Note: timeout increased to 8000ms for slower devices
 */
export async function discoverWsdDevices(
  ip: string,
  port: number,
  timeout = 8000,
): Promise<{
  endpoints: Set<string>;
  deviceTypes: Set<string>;
  scopes: Set<string>;
}> {
  const endpoints = new Set<string>();
  const deviceTypes = new Set<string>();
  const scopes = new Set<string>();

  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const wsdMessage = createWsdMessage();
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
        const response = data.toString();
        
        // Debug: log raw response (optional, can be removed later)
        // console.error(`[WSD-DEBUG] Received from ${ip}:`, response.substring(0, 200));
        
        // Process ProbeMatches responses (case insensitive, namespace flexible)
        if (response.match(/ProbeMatch/i)) {
          const parsed = parseWsdResponse(response);

          // Add XAddrs (endpoints)
          if (parsed.xAddrs) {
            parsed.xAddrs.forEach(addr => {
              // Replace internal IP with target IP for remote access
              try {
                const url = new URL(addr);
                const rewrittenUrl = `${url.protocol}//${ip}:${url.port}${url.pathname}${url.search}`;
                endpoints.add(rewrittenUrl);
              } catch {
                // If URL parsing fails, keep original
                endpoints.add(addr);
              }
            });
          }

          // Add device types
          if (parsed.types) {
            parsed.types.forEach(type => deviceTypes.add(type));
          }

          // Add scopes
          if (parsed.scopes) {
            parsed.scopes.forEach(scope => scopes.add(scope));
          }
        }
      }
    });

    socket.on('error', (err) => {
      safeClose();
      reject(err);
    });

    socket.on('listening', () => {
      socket.send(wsdMessage, port, ip, (err) => {
        if (err) {
          safeClose();
          reject(err);
        }
      });
    });

    socket.bind();

    timeoutHandle = setTimeout(() => {
      safeClose();
      resolve({ endpoints, deviceTypes, scopes });
    }, timeout);
  });
}

/**
 * WS-Discovery Protocol Definition
 * Automatically registered for UDP extra scanning
 */
export const protocol: UDPProtocolDiscovery = {
  name: 'wsd',
  port: 3702,
  service: 'wsd',
  discover: async (ip: string, port: number, timeout: number) => {
    try {
      const wsdResult = await discoverWsdDevices(ip, port, timeout);
      
      if (wsdResult.endpoints.size > 0 || wsdResult.deviceTypes.size > 0) {
        return {
          found: true,
          details: {
            endpoints: Array.from(wsdResult.endpoints),
            deviceTypes: Array.from(wsdResult.deviceTypes),
            scopes: Array.from(wsdResult.scopes)
          }
        };
      }
      return { found: false };
    } catch (error) {
      return { found: false };
    }
  }
};

