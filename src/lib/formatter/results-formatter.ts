/**
 * Results Formatting Module
 * 
 * Functions to format and present scan results in the final output format.
 */

import { Results, FinalResults, LatencyStatistics, HostInfo } from '../scanner/types';

/**
 * Sort hosts by IP address (numerical sort)
 */
function sortHostsByIP(hosts: { [ip: string]: HostInfo }): { [ip: string]: HostInfo } {
    const sortedHosts: { [ip: string]: HostInfo } = {};
    const ips = Object.keys(hosts).sort((a, b) => {
        const aParts = a.split('.').map(Number);
        const bParts = b.split('.').map(Number);
        for (let i = 0; i < 4; i++) {
            if (aParts[i] !== bParts[i]) return aParts[i] - bParts[i];
        }
        return 0;
    });

    for (const ip of ips) {
        const host = hosts[ip];
        
        // Sort TCP and UDP ports separately by port number
        const sortedTcpPorts: { [port: string]: string | null } = {};
        if (host.ports && host.ports.tcp) {
            const tcpPortNumbers = Object.keys(host.ports.tcp).map(Number).sort((a, b) => a - b);
            for (const port of tcpPortNumbers) {
                sortedTcpPorts[port] = host.ports.tcp[port];
            }
        }
        
        const sortedUdpPorts: { [port: string]: string | null } = {};
        if (host.ports && host.ports.udp) {
            const udpPortNumbers = Object.keys(host.ports.udp).map(Number).sort((a, b) => a - b);
            for (const port of udpPortNumbers) {
                sortedUdpPorts[port] = host.ports.udp[port];
            }
        }
        
        sortedHosts[ip] = {
            ping: {
                alive: host.ping.alive,
                ...(host.ping.latency !== null && host.ping.latency !== undefined && { latency: host.ping.latency })
            },
            ports: {
                tcp: sortedTcpPorts,
                udp: sortedUdpPorts
            },
            ...(host.hostname && { hostname: host.hostname }),
            ...(host.adapters && { adapters: host.adapters })
        };
    }
    
    return sortedHosts;
}

/**
 * Calculate latency statistics for alive hosts
 */
function calculateLatencyStats(hosts: { [ip: string]: HostInfo }): LatencyStatistics | null {
    const latencies = Object.values(hosts)
        .filter(h => h.ping.alive && h.ping.latency !== null && h.ping.latency !== undefined)
        .map(h => h.ping.latency)
        .filter((l): l is number => l !== undefined);

    if (latencies.length === 0) {
        return null;
    }

    return {
        min: Math.min(...latencies),
        max: Math.max(...latencies),
        avg: latencies.reduce((sum, l) => sum + l, 0) / latencies.length
    };
}

/**
 * Format results into final output structure
 */
export function formatFinalResults(
    results: Results,
    subnetRange: string,
    traverserDuration: string,
    adapterResultsCount: number
): FinalResults {
    const sortedHosts = sortHostsByIP(results.hosts);
    const latencyStats = calculateLatencyStats(results.hosts);
    
    // Count total TCP and UDP ports
    const totalTCPPorts = Object.values(sortedHosts).reduce((sum, h) => 
        sum + Object.keys(h.ports.tcp || {}).length, 0);
    const totalUDPPorts = Object.values(sortedHosts).reduce((sum, h) => 
        sum + Object.keys(h.ports.udp || {}).length, 0);

    return {
        subnet: subnetRange,
        duration: results.duration!,
        summary: {
            totalHosts: Object.keys(sortedHosts).length,
            aliveHosts: Object.values(sortedHosts).filter(h => h.ping.alive).length,
            hostsWithTCPPorts: Object.values(sortedHosts).filter(h => 
                h.ports.tcp && Object.keys(h.ports.tcp).length > 0
            ).length,
            hostsWithUDPPorts: Object.values(sortedHosts).filter(h => 
                h.ports.udp && Object.keys(h.ports.udp).length > 0
            ).length,
            totalTCPPorts: totalTCPPorts,
            totalUDPPorts: totalUDPPorts
        },
        latency: latencyStats,
        performance: {
            ping: {
                duration: results.performance.ping.duration,
                hostsFound: results.performance.ping.hostsFound,
                rate: (results.performance.ping.hostsFound / parseFloat(results.performance.ping.duration!)).toFixed(2)
            },
            tcp: {
                duration: results.performance.tcp.duration,
                portsFound: results.performance.tcp.portsFound,
                hostsWithPorts: results.performance.tcp.hostsWithPorts,
                rate: (results.performance.tcp.portsFound / parseFloat(results.performance.tcp.duration!)).toFixed(2)
            },
            udp: {
                duration: results.performance.udp.duration,
                portsFound: results.performance.udp.portsFound,
                hostsWithPorts: results.performance.udp.hostsWithPorts,
                rate: (results.performance.udp.portsFound / parseFloat(results.performance.udp.duration!)).toFixed(2)
            }
        },
        hosts: sortedHosts,
        traverser: {
            duration: traverserDuration,
            hostsProcessed: adapterResultsCount
        }
    };
}

/**
 * Print summary statistics to stderr
 */
export function printSummary(results: FinalResults): void {
    console.error('='.repeat(60));
    console.error('SCAN COMPLETED');
    console.error('='.repeat(60));
    console.error(`Duration: ${results.duration}s`);
    console.error(`Total Hosts Discovered: ${results.summary.totalHosts}`);
    console.error(`Alive (ICMP): ${results.summary.aliveHosts}`);
    console.error(`With TCP Ports: ${results.summary.hostsWithTCPPorts}`);
    console.error(`With UDP Ports: ${results.summary.hostsWithUDPPorts}`);
    console.error(`Total TCP Ports: ${results.summary.totalTCPPorts}`);
    console.error(`Total UDP Ports: ${results.summary.totalUDPPorts}`);
    
    if (results.traverser) {
        console.error(`\nTraverser Results:`);
        console.error(`  Duration: ${results.traverser.duration}s`);
        console.error(`  Hosts with adapter data: ${results.traverser.hostsProcessed}`);
    }
    
    if (results.latency) {
        console.error('');
        console.error('Latency Statistics (ms):');
        console.error(`  Min: ${results.latency.min.toFixed(2)}`);
        console.error(`  Avg: ${results.latency.avg.toFixed(2)}`);
        console.error(`  Max: ${results.latency.max.toFixed(2)}`);
    }
    
    console.error('');
    console.error('Performance Summary:');
    console.error('-'.repeat(60));
    
    console.error('PING Scan:');
    console.error(`  Duration: ${results.performance.ping.duration}s`);
    console.error(`  Hosts Found: ${results.performance.ping.hostsFound}`);
    console.error(`  Rate: ${results.performance.ping.rate} hosts/sec`);
    
    console.error('TCP Scan:');
    console.error(`  Duration: ${results.performance.tcp.duration}s`);
    console.error(`  Ports Found: ${results.performance.tcp.portsFound}`);
    console.error(`  Hosts with Ports: ${results.performance.tcp.hostsWithPorts}`);
    console.error(`  Rate: ${results.performance.tcp.rate} ports/sec`);
    
    console.error('UDP Scan:');
    console.error(`  Duration: ${results.performance.udp.duration}s`);
    console.error(`  Ports Found: ${results.performance.udp.portsFound}`);
    console.error(`  Hosts with Ports: ${results.performance.udp.hostsWithPorts}`);
    console.error(`  Rate: ${results.performance.udp.rate} ports/sec`);
    
    console.error('='.repeat(60));
    console.error('');
}

