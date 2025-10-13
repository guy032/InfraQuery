import { spawn } from 'child_process';
import * as os from 'os';
import { PingResult, PingSweepOptions, PingSweepResults } from './types';

/**
 * Ping a single host and return results
 * @param ip - Full IP address to ping
 * @param timeout - Ping timeout in milliseconds
 * @param retries - Number of retry attempts (default: 1)
 * @returns Promise with ping results
 */
async function pingHost(ip: string, timeout: number = 1000, retries: number = 1): Promise<PingResult> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const result = await pingHostOnce(ip, timeout);
        if (result.alive) {
            return result;
        }
    }
    return { alive: false, latency: null };
}

/**
 * Ping a single host once (internal function)
 */
function pingHostOnce(ip: string, timeout: number): Promise<PingResult> {
    return new Promise<PingResult>((resolve) => {
        const platform = os.platform();
        const pingCmd = 'ping';
        const pingArgs: string[] = platform === 'win32' 
            ? ['-n', '1', '-w', (timeout * 1000).toString()]
            : ['-c', '1', '-W', timeout.toString()];

        const ping = spawn(pingCmd, [...pingArgs, ip], {
            stdio: 'pipe'
        });

        let isAlive: boolean = false;
        let latency: number | null = null;
        let output: string = '';

        ping.stdout.on('data', (data) => {
            output += data.toString();
        });

        ping.stderr.on('data', (data) => {
            output += data.toString();
        });

        ping.on('close', (code: number | null) => {
            if (code === 0) {
                isAlive = true;
            } else {
                if (platform === 'win32') {
                    if (output.includes('Reply from') || output.includes('bytes=')) {
                        isAlive = true;
                    }
                } else {
                    if (output.includes('bytes from') || output.includes('64 bytes') || 
                        output.includes('1 received') || output.includes('1 packets received')) {
                        isAlive = true;
                    }
                }
            }

            // Extract latency from ping output
            if (isAlive) {
                let timeMatch: RegExpMatchArray | null;
                if (platform === 'win32') {
                    timeMatch = output.match(/time[=<](\d+(?:\.\d+)?)ms/i);
                } else {
                    timeMatch = output.match(/time=(\d+(?:\.\d+)?)\s*ms/i);
                }
                
                if (timeMatch) {
                    latency = parseFloat(timeMatch[1]);
                }
            }
            
            resolve({ alive: isAlive, latency });
        });

        ping.on('error', () => {
            resolve({ alive: false, latency: null });
        });
    });
}

/**
 * Run a ping sweep on a subnet range
 * @param subnet - Subnet base (e.g., '10.100.102')
 * @param startIP - Starting IP octet
 * @param endIP - Ending IP octet
 * @param options - Options for the sweep
 * @returns Results object with found hosts
 */
async function runPingSweep(
    subnet: string,
    startIP: number,
    endIP: number,
    options: PingSweepOptions = {}
): Promise<PingSweepResults> {
    const { 
        timeout = 1000, 
        concurrency = 254, 
        retries = 1,
        onFound = () => {} 
    } = options;

    console.error(`[PING] Starting ICMP ping sweep of ${subnet}.${startIP}-${endIP}`);
    console.error(`[PING] Concurrency: ${concurrency}, Timeout: ${timeout}ms, Retries: ${retries}\n`);

    const results: PingSweepResults = {};
    const promises: Promise<void>[] = [];
    
    for (let i = startIP; i <= endIP; i++) {
        const fullIP = `${subnet}.${i}`;
        const promise = pingHost(fullIP, timeout, retries).then((result: PingResult) => {
            if (result.alive) {
                results[fullIP] = result;
                const latencyStr = result.latency !== null ? ` (${result.latency.toFixed(2)}ms)` : '';
                process.stderr.write(`[PING] Found: ${fullIP}${latencyStr}\n`);
                onFound(fullIP, result);
            }
        });
        
        promises.push(promise);
        
        // Manage concurrency
        if (promises.length >= concurrency) {
            await Promise.race(promises.map((p: Promise<void>, idx: number) => 
                p.then(() => { promises.splice(idx, 1); })
            ));
        }
    }

    await Promise.all(promises);
    // console.error(`[PING] Completed - Found ${Object.keys(results).length} live hosts\n`);
    
    return results;
}

export {
    pingHost,
    runPingSweep
};
