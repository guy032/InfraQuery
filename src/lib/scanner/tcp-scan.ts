import { spawn, execSync } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { TCPScanOptions, TCPScanResults, NaabuConfig, NaabuResult } from './types';

/**
 * Get the default network interface
 */
function getDefaultInterface(): string | null {
    try {
        const platform = os.platform();
        
        if (platform === 'darwin') {
            const output = execSync('route -n get default 2>/dev/null', { encoding: 'utf8' });
            const match = output.match(/interface:\s*(\w+)/);
            if (match) return match[1];
        } else if (platform === 'linux') {
            const output = execSync('ip route show default 2>/dev/null', { encoding: 'utf8' });
            const match = output.match(/dev\s+(\w+)/);
            if (match) return match[1];
        } else if (platform === 'win32') {
            const output = execSync('route print 0.0.0.0', { encoding: 'utf8' });
            const lines = output.split('\n');
            for (const line of lines) {
                if (line.includes('0.0.0.0') && !line.includes('On-link')) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 4 && parts[0] === '0.0.0.0') {
                        const localIP = parts[3];
                        const interfaces = os.networkInterfaces();
                        for (const [name, addrs] of Object.entries(interfaces)) {
                            if (addrs) {
                                for (const addr of addrs) {
                                    if (addr.address === localIP) {
                                        return name;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        const interfaces = os.networkInterfaces();
        for (const [name, addrs] of Object.entries(interfaces)) {
            if (addrs) {
                for (const addr of addrs) {
                    if (addr.family === 'IPv4' && !addr.internal) {
                        return name;
                    }
                }
            }
        }
    } catch (error) {
        console.error(`Warning: Could not detect default interface: ${(error as Error).message}`);
    }
    
    return null;
}

/**
 * Get the source IP for a given interface
 */
function getSourceIP(interfaceName: string): string | null {
    try {
        const interfaces = os.networkInterfaces();
        const iface = interfaces[interfaceName];
        if (iface) {
            for (const addr of iface) {
                if (addr.family === 'IPv4' && !addr.internal) {
                    return addr.address;
                }
            }
        }
    } catch (error) {
        console.error(`Warning: Could not get IP for interface ${interfaceName}: ${(error as Error).message}`);
    }
    return null;
}

/**
 * Load TCP ports from the data file
 */
function loadPorts(): string {
    const portsFile = path.join(__dirname, '..', 'data', 'tcp-ports.json');
    
    if (!fs.existsSync(portsFile)) {
        console.error(`Error: Ports file not found at ${portsFile}`);
        process.exit(1);
    }

    try {
        const portsData = fs.readFileSync(portsFile, 'utf8');
        const portsArray = JSON.parse(portsData);
        
        if (!Array.isArray(portsArray) || portsArray.length === 0) {
            console.error(`Error: Invalid or empty ports array in ${portsFile}`);
            process.exit(1);
        }
        
        return portsArray.join(',');
    } catch (error) {
        console.error(`Error: Failed to load ports from ${portsFile}: ${(error as Error).message}`);
        process.exit(1);
    }
}

/**
 * Build naabu command arguments
 */
function buildNaabuArgs(config: Partial<NaabuConfig>, ports: string): string[] {
    const args: string[] = [];
    
    for (const [key, value] of Object.entries(config)) {
        if (value === true) {
            args.push(`-${key}`);
        } else if (value === false) {
            args.push(`-${key}=false`);
        } else if (value !== null && value !== undefined) {
            args.push(`-${key}`, String(value));
        }
    }
    
    args.push('-p', ports);
    
    return args;
}

/**
 * Run TCP port scan using naabu
 * @param target - Target subnet in range format (e.g., 10.100.102.1-254)
 * @param options - Scan options
 * @returns Results object with found ports per host
 */
async function runTCPPortScan(
    target: string,
    options: TCPScanOptions = {}
): Promise<TCPScanResults> {
    const { onFound = () => {} } = options;
    
    return new Promise<TCPScanResults>((resolve, reject) => {
        const defaultInterface = getDefaultInterface();
        const defaultSourceIP = defaultInterface ? getSourceIP(defaultInterface) : null;
        const results: TCPScanResults = {};

        // Convert range format (10.100.102.1-254) to comma-separated IPs for naabu
        let hostsForNaabu: string;
        if (target.includes('-')) {
            // Parse range format: 10.100.102.1-254
            const parts = target.split('.');
            const lastOctet = parts[3];
            const [start, end] = lastOctet.split('-').map(Number);
            const baseIP = parts.slice(0, 3).join('.');
            
            // Generate all IPs in range
            const ips: string[] = [];
            for (let i = start; i <= end; i++) {
                ips.push(`${baseIP}.${i}`);
            }
            hostsForNaabu = ips.join(',');
            
            // console.error(`[TCP] Converted range ${target} to ${ips.length} IPs: ${hostsForNaabu.length > 100 ? hostsForNaabu.substring(0, 100) + '...' : hostsForNaabu}`);
        } else {
            hostsForNaabu = target;
        }

        const scanConfig: Partial<NaabuConfig> = {
            host: hostsForNaabu,
            s: 's',
            iv: 4,
            interface: defaultInterface,
            // Don't specify source-ip - let naabu/OS handle routing automatically
            'source-ip': defaultSourceIP,  // Removed: causes routing issues on some networks
            'wn': false,
            c: 200,
            rate: 7500,
            retries: 1,
            timeout: 4000,
            json: true
        };

        const ports = loadPorts();
        const naabuPath = path.join(__dirname, '..', '..', '..', 'bin', 'mac', 'naabu');
        const args = buildNaabuArgs(scanConfig, ports);

        console.error(`[TCP] Starting naabu TCP port scan on ${target}`);
        // console.error(`[TCP] Command: sudo ${naabuPath} ${args.join(' ')}\n`);

        const naabu = spawn('sudo', [naabuPath, ...args], {
            stdio: ['inherit', 'pipe', 'pipe']
        });

        let stdoutEnded = false;
        let processExited = false;

        const checkComplete = () => {
            if (stdoutEnded && processExited) {
                // Both stdout ended AND process exited - safe to resolve
                resolve(results);
            }
        };

        naabu.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach((line: string) => {
                line = line.trim();
                if (line) {
                    try {
                        const result: NaabuResult = JSON.parse(line);
                        const ip = result.ip;
                        const port = result.port;

                        if (!results[ip]) {
                            results[ip] = [];
                        }
                        results[ip].push(port);
                        
                        process.stderr.write(`[TCP] Found: ${ip}:${port}\n`);
                        onFound(ip, port);
                    } catch (e) {
                        // Not valid JSON, ignore
                    }
                }
            });
        });

        naabu.stdout.on('end', () => {
            stdoutEnded = true;
            checkComplete();
        });

        naabu.stderr.on('data', (data) => {
            // console.log(data.toString());
            // Filter naabu stderr - only show actual errors, not banner/info/warnings
            const output = data.toString();
            const lines = output.split('\n');
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                
                // Skip banner ASCII art
                if (trimmed.includes('___') || trimmed.includes('projectdiscovery.io')) {
                    continue;
                }
                
                // Skip info and warning messages
                if (trimmed.includes('[INF]') || trimmed.includes('[WRN]')) {
                    continue;
                }
                
                // Only log actual errors or unexpected output
                if (trimmed.includes('[ERR]') || trimmed.includes('[FTL]')) {
                    console.error(`[TCP-NAABU] ${trimmed}`);
                }
            }
        });

        naabu.on('error', (error) => {
            reject(error);
        });

        naabu.on('close', (code: number | null) => {
            processExited = true;
            checkComplete();
        });
    });
}

export {
    runTCPPortScan,
    getDefaultInterface,
    getSourceIP
};
