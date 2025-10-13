import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { UDPScanOptions, UDPScanResults, UDPPortInfo, UdpzResult } from './types';

/**
 * Run UDP port scan using udpz
 * @param target - Target subnet in range format (e.g., 10.100.102.1-254)
 * @param options - Scan options
 * @returns Results object with found UDP ports per host
 */
async function runUDPScan(
    target: string,
    options: UDPScanOptions = {}
): Promise<UDPScanResults> {
    const { 
        timeout = 1000,
        concurrency = 128,
        retries = 1,
        onFound = () => {}
    } = options;

    return new Promise<UDPScanResults>((resolve) => {
        const udpzPath = path.join(__dirname, '..', '..', '..', 'bin', 'udpz');
        const results: UDPScanResults = {};

        // Check if udpz exists
        if (!fs.existsSync(udpzPath)) {
            console.error(`[UDP] Warning: udpz not found at ${udpzPath}, skipping UDP scan`);
            resolve(results);
            return;
        }

        console.error(`[UDP] Starting udpz UDP scan on ${target}`);
        console.error(`[UDP] Host concurrency: ${concurrency}, Timeout: ${timeout}ms`);

        // Convert range format (10.100.102.1-254) to individual IPs for udpz
        let hostsForUdpz: string[];
        if (target.includes('-')) {
            // Parse range format: 10.100.102.1-254
            const parts = target.split('.');
            const lastOctet = parts[3];
            const [start, end] = lastOctet.split('-').map(Number);
            const baseIP = parts.slice(0, 3).join('.');
            
            // Generate all IPs in range
            hostsForUdpz = [];
            for (let i = start; i <= end; i++) {
                hostsForUdpz.push(`${baseIP}.${i}`);
            }
            
            console.error(`[UDP] Converted range ${target} to ${hostsForUdpz.length} individual IPs`);
        } else {
            hostsForUdpz = [target];
        }

        // Build udpz command - pass IPs as separate arguments (space-separated)
        const args: string[] = [
            // '-f', 'json',  // JSON output format
            '-c', Math.floor(concurrency / 2).toString(),  // Host concurrency (doubled)
            '-P', '100',  // Port tasks per host
            '-t', timeout.toString(),  // Timeout in milliseconds
            '-r', retries.toString(),  // Retries
            // '-q',  // Quiet mode (disable info logging)
            ...hostsForUdpz  // Spread IPs as individual arguments
        ];

        // console.error(`[UDP] Command: ${udpzPath} ${args.join(' ')}\n`);

        const udpz = spawn(udpzPath, args, {
            stdio: ['inherit', 'pipe', 'pipe']
        });

        let jsonBuffer: string = '';
        let lineBuffer: string = '';
        let stdoutEnded = false;
        let processExited = false;

        const processJsonLine = (line: string) => {
            line = line.trim();
            if (!line) return;
            
            try {
                const result: UdpzResult = JSON.parse(line);
                
                const ip: string | undefined = typeof result.host === 'object' 
                    ? result.host?.host 
                    : result.host as string;
                const port: number = result.port;
                const serviceName: string = result.service?.slug || result.probe?.slug || 'unknown';
                
                if (ip && port) {
                    if (!results[ip]) {
                        results[ip] = [];
                    }
                    
                    // Store port with service name
                    const portInfo: UDPPortInfo = {
                        port: port,
                        service: serviceName
                    };
                    
                    results[ip].push(portInfo);
                    
                    // Real-time logging!
                    process.stderr.write(`[UDP] Found: ${ip}:${port} (${serviceName})\n`);
                    onFound(ip, portInfo);
                }
            } catch (e) {
                // Not a valid JSON line, might be part of array format
                // Buffer it for later processing
            }
        };

        const processResults = () => {
            if (jsonBuffer.trim()) {
                try {
                    const udpResults: UdpzResult[] = JSON.parse(jsonBuffer);
                    
                    // Process each result (for array format)
                    if (Array.isArray(udpResults)) {
                        for (const result of udpResults) {
                            const ip: string | undefined = typeof result.host === 'object' 
                                ? result.host?.host 
                                : result.host as string;
                            const port: number = result.port;
                            const serviceName: string = result.service?.slug || result.probe?.slug || 'unknown';
                            
                            if (ip && port) {
                                // Check if we already processed this (from line-by-line parsing)
                                const alreadyProcessed = results[ip]?.some(p => p.port === port);
                                if (!alreadyProcessed) {
                                    if (!results[ip]) {
                                        results[ip] = [];
                                    }
                                    
                                    const portInfo: UDPPortInfo = {
                                        port: port,
                                        service: serviceName
                                    };
                                    
                                    results[ip].push(portInfo);
                                    process.stderr.write(`[UDP] Found: ${ip}:${port} (${serviceName})\n`);
                                    onFound(ip, portInfo);
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Silent - already logged individual lines if possible
                }
            }
        };

        const checkComplete = () => {
            if (stdoutEnded && processExited) {
                // Both stdout ended AND process exited - safe to process and resolve
                processResults();
                resolve(results);
            }
        };

        udpz.stdout.on('data', (data) => {
            const chunk = data.toString();
            jsonBuffer += chunk;
            lineBuffer += chunk;
            
            // Try to process line-delimited JSON (NDJSON format)
            const lines = lineBuffer.split('\n');
            // Keep the last incomplete line in the buffer
            lineBuffer = lines.pop() || '';
            
            // Process each complete line
            for (const line of lines) {
                processJsonLine(line);
            }
        });

        udpz.stdout.on('end', () => {
            stdoutEnded = true;
            checkComplete();
        });

        udpz.stderr.on('data', (data) => {
            // Log errors if needed (filter out "network is unreachable" errors)
            const output = data.toString();
            if ((output.includes('Error') || output.includes('error')) 
                && !output.includes('network is unreachable')) {
                process.stderr.write(`[UDP] ${output}`);
            }
        });

        udpz.on('error', (error) => {
            console.error(`[UDP] Error: ${error.message}`);
            resolve(results);
        });

        udpz.on('close', (code: number | null) => {
            processExited = true;
            checkComplete();
        });
    });
}

export {
    runUDPScan
};
