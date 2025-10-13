/**
 * Scan Orchestration Module
 * 
 * Functions to execute various network scans (ping, TCP, UDP)
 * and collect results in a unified format.
 */

import { runPingSweep } from './ping';
import { runTCPPortScan } from './tcp-scan';
import { runUDPScan } from './udp-scan';
import { runUDPExtraScan } from './udp-extra-scan';
import * as portLookupData from '../data/port-lookup.json';
import { Results, PortLookup, PingResult, UDPPortInfo, UDPExtraPortInfo } from './types';

const portLookup = portLookupData as PortLookup;

/**
 * Configuration for network scans
 */
export interface ScanConfig {
    subnet: string;
    startIP: number;
    endIP: number;
    subnetRange: string;
    pingTimeout: number;
    pingConcurrent: number;
    pingRetries: number;
    udpTimeout: number;
    udpConcurrency: number;
    udpRetries: number;
}

/**
 * Execute ping sweep across the subnet
 */
export async function executePingSweep(config: ScanConfig, results: Results): Promise<void> {
    results.performance.ping.startTime = Date.now();
    
    await runPingSweep(config.subnet, config.startIP, config.endIP, {
        timeout: config.pingTimeout,
        concurrency: config.pingConcurrent,
        retries: config.pingRetries,
        onFound: (ip: string, result: PingResult) => {
            results.performance.ping.hostsFound++;
            if (!results.hosts[ip]) {
                results.hosts[ip] = { 
                    ping: { alive: true, latency: result.latency || undefined },
                    ports: { tcp: {}, udp: {} }
                };
            } else {
                results.hosts[ip].ping = { alive: true, latency: result.latency || undefined };
            }
        }
    });
    
    results.performance.ping.endTime = Date.now();
    results.performance.ping.duration = ((results.performance.ping.endTime - results.performance.ping.startTime) / 1000).toFixed(2);
}

/**
 * Execute TCP port scan across the subnet
 */
export async function executeTCPScan(config: ScanConfig, results: Results): Promise<void> {
    results.performance.tcp.startTime = Date.now();
    const tcpHosts = new Set<string>();
    
    await runTCPPortScan(config.subnetRange, {
        onFound: (ip: string, port: number) => {
            if (!results.hosts[ip]) {
                results.hosts[ip] = { 
                    ping: { alive: false },
                    ports: { tcp: {}, udp: {} }
                };
            }
            
            // Initialize ports structure if it doesn't exist
            if (!results.hosts[ip].ports) {
                results.hosts[ip].ports = { tcp: {}, udp: {} };
            }
            if (!results.hosts[ip].ports.tcp) {
                results.hosts[ip].ports.tcp = {};
            }
            
            // Add TCP service if not already present
            if (!(port in results.hosts[ip].ports.tcp)) {
                // Look up service name from port-lookup.json
                const serviceName = portLookup[port.toString()] || null;
                results.hosts[ip].ports.tcp[port] = serviceName;
                results.performance.tcp.portsFound++;
                tcpHosts.add(ip);
            }
        }
    });
    
    results.performance.tcp.hostsWithPorts = tcpHosts.size;
    results.performance.tcp.endTime = Date.now();
    results.performance.tcp.duration = ((results.performance.tcp.endTime - results.performance.tcp.startTime) / 1000).toFixed(2);
}

/**
 * Execute UDP port scan across the subnet
 */
export async function executeUDPScan(config: ScanConfig, results: Results): Promise<void> {
    results.performance.udp.startTime = Date.now();
    const udpHosts = new Set<string>();
    
    await runUDPScan(config.subnetRange, {
        timeout: config.udpTimeout,
        concurrency: config.udpConcurrency,
        retries: config.udpRetries,
        onFound: (ip: string, portInfo: UDPPortInfo) => {
            if (!results.hosts[ip]) {
                results.hosts[ip] = { 
                    ping: { alive: false },
                    ports: { tcp: {}, udp: {} }
                };
            }
            
            const port = portInfo.port;
            
            // Initialize ports structure if it doesn't exist
            if (!results.hosts[ip].ports) {
                results.hosts[ip].ports = { tcp: {}, udp: {} };
            }
            if (!results.hosts[ip].ports.udp) {
                results.hosts[ip].ports.udp = {};
            }
            
            // Add UDP service if not already present
            if (!(port in results.hosts[ip].ports.udp)) {
                // Use the service name from udpz or fallback to port-lookup.json
                let serviceName: string | null = portInfo.service;
                if (serviceName === 'unknown' || !serviceName) {
                    serviceName = portLookup[port.toString()] || null;
                }
                results.hosts[ip].ports.udp[port] = serviceName;
                results.performance.udp.portsFound++;
                udpHosts.add(ip);
            }
        }
    });
    
    results.performance.udp.hostsWithPorts = udpHosts.size;
    results.performance.udp.endTime = Date.now();
    results.performance.udp.duration = ((results.performance.udp.endTime - results.performance.udp.startTime) / 1000).toFixed(2);
}

/**
 * Execute UDP extra scan (protocol-specific probes)
 */
export async function executeUDPExtraScan(config: ScanConfig, results: Results): Promise<void> {
    results.performance.udpExtra.startTime = Date.now();
    const udpExtraHosts = new Set<string>();
    
    // Generate all IPs in the subnet range (don't wait for ping!)
    const targets: string[] = [];
    for (let i = config.startIP; i <= config.endIP; i++) {
        targets.push(`${config.subnet}.${i}`);
    }
    
    // Scan ALL hosts in the subnet, not just ping responders
    await runUDPExtraScan(targets, {
        timeout: 2000,
        concurrency: 100,
        onFound: (ip: string, portInfo: UDPExtraPortInfo) => {
            if (!results.hosts[ip]) {
                results.hosts[ip] = { 
                    ping: { alive: false },
                    ports: { tcp: {}, udp: {} }
                };
            }
            
            const port = portInfo.port;
            
            // Initialize ports structure if it doesn't exist
            if (!results.hosts[ip].ports) {
                results.hosts[ip].ports = { tcp: {}, udp: {} };
            }
            if (!results.hosts[ip].ports.udp) {
                results.hosts[ip].ports.udp = {};
            }
            
            // Add or update UDP service with extra information
            const serviceName = portInfo.protocol || portInfo.service;
            results.hosts[ip].ports.udp[port] = serviceName;
            results.performance.udpExtra.portsFound++;
            udpExtraHosts.add(ip);
        }
    });
    
    results.performance.udpExtra.hostsWithPorts = udpExtraHosts.size;
    results.performance.udpExtra.endTime = Date.now();
    results.performance.udpExtra.duration = ((results.performance.udpExtra.endTime - results.performance.udpExtra.startTime) / 1000).toFixed(2);
}

/**
 * Execute all scans in parallel
 */
export async function executeAllScans(config: ScanConfig, results: Results): Promise<void> {
    // // Executing Pings AND UDP Extra
    // await Promise.all([
    //     executePingSweep(config, results),
    //     executeUDPExtraScan(config, results),
    // ]);

    // console.log('Executing TCP scan');
    // await executeTCPScan(config, results);
    console.log('Executing UDP scan');
    await executeUDPScan(config, results);
}
