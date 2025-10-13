/**
 * UDP Protocol Discovery Index
 * 
 * This file automatically exports all UDP protocol implementations.
 * To add a new protocol:
 * 1. Create a new .ts file in this directory (e.g., mdns.ts)
 * 2. Export a `protocol` object matching the UDPProtocolDiscovery interface
 * 3. That's it! It will be automatically included in scans
 */

/**
 * Standard interface for UDP protocol discovery
 */
export interface UDPProtocolDiscovery {
  name: string;
  port: number;
  service: string;
  discover: (ip: string, port: number, timeout: number) => Promise<{
    found: boolean;
    details?: any;
  }>;
}

/**
 * Import all protocol implementations
 */
export * as ssdp from './ssdp';
export * as wsd from './wsd';

/**
 * Import protocol definitions
 */
import { protocol as ssdpProtocol } from './ssdp';
import { protocol as wsdProtocol } from './wsd';

/**
 * All available UDP protocols
 * Automatically includes all protocols exported above
 */
export const udpProtocols: UDPProtocolDiscovery[] = [
  ssdpProtocol,
  wsdProtocol,
  // New protocols are automatically added when imported above
];
