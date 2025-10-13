#!/usr/bin/env node

/**
 * InfraQuery - Advanced Network Discovery Tool
 * 
 * Main entry point that orchestrates all scanning, discovery, and reporting.
 */

import { requireElevatedPrivileges } from './lib/utils/privileges';
import { executeAllScans, ScanConfig } from './lib/scanner/scan-orchestrator';
import { postProcessResults } from './lib/scanner/post-processor';
import { executeReverseDNSLookups } from './lib/utils/reverse-dns';
import { executeTraversersForAllHosts, TraverserOptions } from './lib/traverser/traverser-executor';
import { formatFinalResults, printSummary } from './lib/formatter/results-formatter';
import { Results } from './lib/scanner/types';

// ============= Configuration =============

const subnet: string = process.argv[2] ? process.argv[2].split('.').slice(0, 3).join('.') : '103.46.238';
const startIP: number = 1;
const endIP: number = 254;
const subnetRange: string = `${subnet}.${startIP}-${endIP}`;

const scanConfig: ScanConfig = {
    subnet,
    startIP,
    endIP,
    subnetRange,
    pingTimeout: 500,
    pingConcurrent: 254,
    pingRetries: 1,
    udpTimeout: 500,
    udpConcurrency: 10,
    udpRetries: 0
};

const traverserOptions: TraverserOptions = {
    timeout: 60000,  // 60 seconds for slow protocols
    concurrency: 10,  // Reduced concurrency to avoid overwhelming network
    verbose: true
};

// ============= Main Execution =============

async function main(): Promise<void> {
    // Check for elevated privileges before starting
    requireElevatedPrivileges();
    
    console.error('='.repeat(60));
    console.error('COMBINED NETWORK SCAN (TCP + UDP + UDP-EXTRA)');
    console.error('='.repeat(60));
    console.error(`Target: ${subnetRange}\n`);

    try {
        // Initialize results storage
        const results: Results = {
            hosts: {},
            startTime: Date.now(),
            endTime: null,
            performance: {
                ping: { startTime: null, endTime: null, duration: null, hostsFound: 0 },
                tcp: { startTime: null, endTime: null, duration: null, portsFound: 0, hostsWithPorts: 0 },
                udp: { startTime: null, endTime: null, duration: null, portsFound: 0, hostsWithPorts: 0 },
                udpExtra: { startTime: null, endTime: null, duration: null, portsFound: 0, hostsWithPorts: 0 }
            }
        };

        // Step 1: Execute all scans in parallel
        await executeAllScans(scanConfig, results);

        // Step 2: Post-process results (port corrections, etc.)
        postProcessResults(results);

        // Step 3: Perform reverse DNS lookups
        await executeReverseDNSLookups(results.hosts);

        // Step 4: Execute protocol traversers for discovered services
        console.error('\n' + '='.repeat(60));
        console.error('EXECUTING PROTOCOL TRAVERSERS');
        console.error('='.repeat(60));
        
        const startTraverser = Date.now();
        const adapterResults = await executeTraversersForAllHosts(results.hosts, traverserOptions);
        const traverserDuration = ((Date.now() - startTraverser) / 1000).toFixed(2);
        
        // Add adapter results to each host
        for (const [ip, adapters] of Object.entries(adapterResults)) {
            if (results.hosts[ip]) {
                results.hosts[ip].adapters = adapters;
            }
        }
        
        console.error(`\nTraverser execution completed in ${traverserDuration}s`);
        console.error(`Hosts with adapter data: ${Object.keys(adapterResults).length}`);

        // Step 5: Finalize and format results
        results.endTime = Date.now();
        results.duration = ((results.endTime - results.startTime) / 1000).toFixed(2);

        const finalResults = formatFinalResults(
            results,
            subnetRange,
            traverserDuration,
            Object.keys(adapterResults).length
        );

        // Step 6: Print summary to stderr and JSON to stdout
        printSummary(finalResults);
        console.log(JSON.stringify(finalResults, null, 2));

    } catch (error) {
        console.error(`Error during scan: ${(error as Error).message}`);
        process.exit(1);
    }
}

main();
