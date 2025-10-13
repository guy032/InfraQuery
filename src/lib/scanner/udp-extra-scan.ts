/**
 * UDP Extra Scan Module
 * 
 * This module provides custom UDP protocol probes that are not included in standard
 * UDP scanning tools (udpz/udpx). It's designed to be easily extensible for additional
 * protocol discovery mechanisms.
 * 
 * Current Protocols:
 * - SSDP/UPnP: Service discovery protocol (port 1900)
 * - WS-Discovery: Web Services Dynamic Discovery (port 3702)
 * 
 * To add a new protocol:
 * 1. Create a new module in src/lib/scanner/udp/ (e.g., mdns.ts)
 * 2. Add the protocol to src/lib/scanner/udp/index.ts
 * 3. That's it! It will be automatically included in scans
 */

import { UDPExtraScanOptions, UDPExtraScanResults, UDPExtraPortInfo } from './types';
import { udpProtocols } from './udp';

/**
 * Run UDP Extra scans with custom protocol probes
 * Currently supports:
 * - SSDP/UPnP discovery (port 1900)
 * - WS-Discovery (port 3702)
 * 
 * @param targets - Array of target IPs to probe
 * @param options - Scan options
 * @returns Results object with found services per host
 */
async function runUDPExtraScan(
    targets: string[],
    options: UDPExtraScanOptions = {}
): Promise<UDPExtraScanResults> {
    const { 
        timeout = 2000,
        concurrency = 100,  // Default to 50 concurrent targets
        onFound = () => {}
    } = options;

    const results: UDPExtraScanResults = {};

    console.error(`[UDP-EXTRA] Starting custom UDP probes on ${targets.length} target(s)`);
    console.error(`[UDP-EXTRA] Protocols: ${udpProtocols.map(p => p.name).join(', ')}`);
    console.error(`[UDP-EXTRA] Concurrency: ${concurrency}, Timeout: ${timeout}ms\n`);

    // Process targets in batches based on concurrency
    for (let i = 0; i < targets.length; i += concurrency) {
        const batch = targets.slice(i, i + concurrency);
        
        await Promise.all(
            batch.map(async (ip) => {
                // Probe all registered protocols
                for (const protocol of udpProtocols) {
                    try {
                        const result = await protocol.discover(ip, protocol.port, timeout);
                        
                        if (result.found) {
                            if (!results[ip]) {
                                results[ip] = [];
                            }

                            const portInfo: UDPExtraPortInfo = {
                                port: protocol.port,
                                service: protocol.service,
                                protocol: protocol.name,
                                details: result.details
                            };

                            results[ip].push(portInfo);
                            
                            // Build a descriptive message based on protocol
                            let detailsStr = '';
                            if (result.details) {
                                if (result.details.locations) {
                                    detailsStr = ` - ${result.details.locations.length} location(s)`;
                                } else if (result.details.endpoints) {
                                    const typeStr = result.details.deviceTypes?.length > 0
                                        ? ` - Types: ${result.details.deviceTypes.join(', ')}`
                                        : '';
                                    detailsStr = ` - ${result.details.endpoints.length} endpoint(s)${typeStr}`;
                                }
                            }
                            
                            process.stderr.write(
                                `[UDP-EXTRA] Found: ${ip}:${protocol.port} (${protocol.name})${detailsStr}\n`
                            );
                            
                            onFound(ip, portInfo);
                        }
                    } catch (error) {
                        // Silently ignore probe failures
                        // This is expected behavior for hosts that don't support the protocol
                    }
                }
            })
        );
    }

    return results;
}

export {
    runUDPExtraScan
};

