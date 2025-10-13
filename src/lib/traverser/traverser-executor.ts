/**
 * Traverser Executor Module
 * Executes protocol adapters for discovered services and aggregates results
 */

import * as adaptersConfigData from '../data/adapters.json';

// Type the adaptersConfig properly
const adaptersConfig = adaptersConfigData as Record<string, string | null>;

// Dynamically import adapters to handle missing dependencies gracefully
let adapters: any = {};

try {
  // Try to load real adapters from the compiled output
  adapters = require('./adapter');
} catch (error) {
  console.error('[Traverser] Warning: Could not load protocol adapters from ./adapter');
  console.error('[Traverser] Adapters will not be available. Error:', (error as any).message);
}

/**
 * Adapter function type
 */
type AdapterDiscoverFunction = (
  agent: string,
  port: number,
  options?: any
) => Promise<any>;

/**
 * Map of service names to their adapter discover functions
 * Attempts to use real protocol adapters if available
 */
const adapterFunctions: Record<string, AdapterDiscoverFunction | undefined> = {
  bacnet: adapters.bacnet?.discover,
  cip: adapters.cip?.discover,
  dns: adapters.dns?.discover,
  http: adapters.http?.discover,
  https: adapters.http?.discover,  // Use same adapter for HTTPS
  mdns: adapters.mdns?.discover,
  modbus: adapters.modbus?.discover,
  opcua: adapters.opcua?.discover,
  prometheus: adapters.prometheus?.discover,
  s7comm: adapters.s7comm?.discover,
  sip: adapters.sip?.discover,
  // Use parallel SNMP discovery (tries v2c, v1, v3 simultaneously)
  snmp: adapters.snmp?.discoverParallel || adapters.snmp?.discover,
  ssdp: adapters.upnp?.discover,  // SSDP uses the UPNP adapter
  ssh: adapters.ssh?.discover,
  sshAlt: adapters.ssh?.discover,  // Use same adapter for alternate SSH port
  upnp: adapters.upnp?.discover,
  winrm: adapters.winrm?.discover,
  wsd: adapters.wsd?.discover,
  wsdl: adapters.wsdl?.discover,
  wsman: adapters.wsman?.discover,
};

/**
 * Default port mappings for protocols
 */
const defaultPorts: Record<string, number> = {
  bacnet: 47808,
  cip: 44818,
  dns: 53,
  http: 80,
  https: 443,
  mdns: 5353,
  modbus: 502,
  opcua: 4840,
  prometheus: 9100,
  s7comm: 102,
  sip: 5060,
  snmp: 161,
  ssdp: 1900,
  ssh: 22,
  upnp: 1900,
  winrm: 5985,
  wsd: 3702,
  wsdl: 3702,
  wsman: 5985,
};

export interface TraverserOptions {
  timeout?: number;
  concurrency?: number;
  verbose?: boolean;
}

export interface AdapterResults {
  [protocol: string]: any;
}

/**
 * Execute a single adapter for a service
 */
async function executeAdapter(
  ip: string,
  port: number,
  serviceName: string,
  adapterName: string,
  options: TraverserOptions
): Promise<{ protocol: string; result: any } | null> {
  try {
    const adapterFunc = adapterFunctions[adapterName];
    if (!adapterFunc) {
      if (options.verbose) {
        console.error(`[Traverser] No adapter function available for ${adapterName} (service: ${serviceName})`);
      }
      return null;
    }

    if (options.verbose) {
      console.error(`[Traverser] Running ${adapterName} adapter for ${ip}:${port}`);
    }

    // Execute the adapter with appropriate timeout
    // Give the adapter slightly less time than the external timeout to avoid race conditions
    const adapterTimeout = (options.timeout || 3000) * 0.9;  // 90% of external timeout
    const externalTimeout = options.timeout || 3000;
    
    const result = await Promise.race([
      adapterFunc(ip, port, { 
        timeout: adapterTimeout,
        ...options 
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Adapter timeout after ${externalTimeout}ms`)), externalTimeout)
      )
    ]);

    if (result && (Array.isArray(result) ? result.length > 0 : Object.keys(result).length > 0)) {
      if (options.verbose) {
        console.error(`[Traverser] ${adapterName} adapter found data for ${ip}:${port}`);
      }
      return { protocol: adapterName, result };
    }

    return null;
  } catch (error: any) {
    if (options.verbose) {
      console.error(`[Traverser] Error running ${adapterName} adapter for ${ip}:${port}:`, error.message || error);
    }
    return null;
  }
}

/**
 * Execute traversers for discovered services on a host
 */
export async function executeTraversersForHost(
  ip: string,
  tcpPorts: Record<number, string | null>,
  udpPorts: Record<number, string | null>,
  options: TraverserOptions = {}
): Promise<AdapterResults> {
  const results: AdapterResults = {};
  const adapterPromises: Promise<{ protocol: string; result: any } | null>[] = [];
  const queuedAdapters = new Set<string>(); // Track which adapters have been queued

  // Process TCP ports
  for (const [portStr, serviceName] of Object.entries(tcpPorts)) {
    const port = parseInt(portStr);
    if (serviceName && adaptersConfig[serviceName]) {
      const adapterName = adaptersConfig[serviceName];
      if (adapterName && !queuedAdapters.has(adapterName)) {
        queuedAdapters.add(adapterName);
        adapterPromises.push(
          executeAdapter(ip, port, serviceName, adapterName, options)
        );
      }
    }
  }

  // Process UDP ports
  for (const [portStr, serviceName] of Object.entries(udpPorts)) {
    const port = parseInt(portStr);
    if (serviceName && adaptersConfig[serviceName]) {
      const adapterName = adaptersConfig[serviceName];
      if (adapterName && !queuedAdapters.has(adapterName)) {
        queuedAdapters.add(adapterName);
        adapterPromises.push(
          executeAdapter(ip, port, serviceName, adapterName, options)
        );
      }
    }
  }

  // Execute all adapters in parallel with concurrency control
  const concurrency = options.concurrency || 5;
  const adapterResults: ({ protocol: string; result: any } | null)[] = [];
  
  for (let i = 0; i < adapterPromises.length; i += concurrency) {
    const batch = adapterPromises.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch);
    adapterResults.push(...batchResults);
  }

  // Aggregate results by protocol
  for (const adapterResult of adapterResults) {
    if (adapterResult) {
      const { protocol, result } = adapterResult;
      
      // Process the result based on its format
      if (Array.isArray(result) && result.length > 0) {
        // For adapters that return arrays of metrics (like SNMP)
        const processedResult: any = {};
        
        for (const metric of result) {
          if (metric && metric.fields) {
            Object.assign(processedResult, metric.fields);
          }
          if (metric && metric.tags) {
            Object.assign(processedResult, metric.tags);
          }
        }
        
        if (Object.keys(processedResult).length > 0) {
          results[protocol] = processedResult;
        }
      } else if (result && typeof result === 'object') {
        // For adapters that return objects directly
        results[protocol] = result;
      }
    }
  }

  return results;
}

/**
 * Execute traversers for all hosts in scan results
 */
export async function executeTraversersForAllHosts(
  hosts: Record<string, any>,
  options: TraverserOptions = {}
): Promise<Record<string, AdapterResults>> {
  const allResults: Record<string, AdapterResults> = {};
  
  // Process hosts in batches for better performance
  const hostEntries = Object.entries(hosts);
  const hostConcurrency = options.concurrency || 3; // Process 3 hosts at a time
  
  for (let i = 0; i < hostEntries.length; i += hostConcurrency) {
    const batch = hostEntries.slice(i, i + hostConcurrency);
    
    await Promise.all(
      batch.map(async ([ip, hostInfo]) => {
        if (hostInfo.ports?.tcp || hostInfo.ports?.udp) {
          const tcpPorts = hostInfo.ports.tcp || {};
          const udpPorts = hostInfo.ports.udp || {};
          
          // Skip hosts with no services
          if (Object.keys(tcpPorts).length === 0 && Object.keys(udpPorts).length === 0) {
            return;
          }
          
          if (options.verbose) {
            console.error(`[Traverser] Processing host ${ip} with ${Object.keys(tcpPorts).length} TCP and ${Object.keys(udpPorts).length} UDP services`);
          }
          
          const adapterResults = await executeTraversersForHost(
            ip, 
            tcpPorts, 
            udpPorts, 
            options
          );
          
          if (Object.keys(adapterResults).length > 0) {
            allResults[ip] = adapterResults;
          }
        }
      })
    );
  }
  
  return allResults;
}
