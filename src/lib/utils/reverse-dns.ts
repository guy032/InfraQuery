/**
 * Reverse DNS Lookup Utilities
 * 
 * Functions to perform reverse DNS lookups using system DNS servers.
 */

import * as dns from 'dns';
import { promisify } from 'util';
import { HostInfo } from '../scanner/types';
import { isPrivateIP } from './ip-utils';

const dnsReverse = promisify(dns.reverse);

/**
 * Perform reverse DNS lookup for an IP address using system DNS
 * @param ip - IP address to lookup
 * @returns hostname or null if not found
 */
export async function performReverseDNS(ip: string): Promise<string | null> {
    try {
        const hostnames = await dnsReverse(ip);
        return hostnames && hostnames.length > 0 ? hostnames[0] : null;
    } catch (error) {
        // Reverse DNS failed (common for IPs without PTR records)
        return null;
    }
}

/**
 * Perform reverse DNS lookups for all discovered hosts
 * Uses system DNS for public IPs
 * Skips private IPs with DNS port open (handled by DNS adapter)
 */
export async function executeReverseDNSLookups(hosts: { [ip: string]: HostInfo }): Promise<void> {
    console.error('\n' + '='.repeat(60));
    console.error('PERFORMING REVERSE DNS LOOKUPS');
    console.error('='.repeat(60));
    
    const ips = Object.keys(hosts);
    const lookupPromises = ips.map(async (ip) => {
        const host = hosts[ip];
        const hasDNSPort = host.ports.tcp && host.ports.tcp[53];
        const isPrivate = isPrivateIP(ip);
        
        // Skip private IPs with DNS port (DNS adapter will handle these)
        if (isPrivate && hasDNSPort) {
            console.error(`[ReverseDNS] Skipping ${ip} - private IP with DNS port (handled by DNS adapter)`);
            return;
        }
        
        // Perform reverse DNS lookup using system DNS
        console.error(`[ReverseDNS] Looking up ${ip}...`);
        const hostname = await performReverseDNS(ip);
        
        if (hostname) {
            console.error(`[ReverseDNS] ${ip} → ${hostname}`);
            // Add hostname to host info
            if (!hosts[ip].hostname) {
                hosts[ip].hostname = hostname;
            }
        } else {
            console.error(`[ReverseDNS] ${ip} - no PTR record found`);
        }
    });
    
    await Promise.all(lookupPromises);
    
    const hostsWithHostnames = Object.values(hosts).filter(h => h.hostname).length;
    console.error(`\nReverse DNS complete. Found hostnames for ${hostsWithHostnames}/${ips.length} hosts`);
}

