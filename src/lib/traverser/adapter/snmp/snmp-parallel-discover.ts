/**
 * Parallel SNMP Discovery
 * Tries all SNMP versions in parallel: v2c, v1, v3
 */

import { discover as discoverV1V2 } from './snmp-discover';
import { discoverSNMPv3 } from './snmpv3-discovery';

export interface ParallelSnmpResult {
  v2c?: any;
  v1?: any;
  v3?: any;
  bestVersion?: 'v2c' | 'v1' | 'v3' | null;
  aggregated: any;
}

/**
 * Discover SNMP device using all versions in parallel
 * Priority: v2c > v1 > v3
 */
export async function discoverParallel(
  agent: string,
  port = 161,
  options: any = {}
): Promise<any[]> {
  const {
    timeout = 3000,
    community = 'public',
    verbose = false,
  } = options;

  if (verbose) {
    console.error(`[SNMP Parallel] Starting discovery for ${agent}:${port} (timeout: ${timeout}ms, community: ${community})`);
  }

  // Try all three versions in parallel
  // Give each version a shorter timeout since they run in parallel
  // This prevents one slow version from blocking everything
  const perVersionTimeout = Math.min(timeout * 0.4, 10000); // Max 10 seconds per version
  
  const [v2cResult, v1Result, v3Result] = await Promise.allSettled([
    // Try v2c
    discoverV1V2(agent, port, {
      version: 2,
      community,
      timeout: perVersionTimeout,
      collectVendorData: true,
    }),
    // Try v1
    discoverV1V2(agent, port, {
      version: 1,
      community,
      timeout: perVersionTimeout,
      collectVendorData: true,
    }),
    // Try v3 (just discovery, no authentication)
    discoverSNMPv3(agent, perVersionTimeout).then(v3Info => {
      if (v3Info.success) {
        return [{
          name: 'snmp',
          tags: {
            agent,
            protocol: 'snmp',
            port: port.toString(),
            version: 'v3',
          },
          fields: {
            available: 1,
            snmp_service: 1,
            version: 'v3',
            snmpv3_enterprise: v3Info.enterprise || 0,
            snmpv3_enterprise_name: v3Info.enterpriseName || 'Unknown',
            snmpv3_engine_id_format: v3Info.engineIDFormat || 'unknown',
            snmpv3_engine_id_data: v3Info.engineIDData || '',
            snmpv3_engine_boots: v3Info.engineBoots || 0,
            snmpv3_engine_time: v3Info.engineTime || 0,
            snmpv3_engine_time_formatted: v3Info.engineTimeFormatted || '',
            snmpv3_engine_id_raw: v3Info.raw || '',
          },
          timestamp: Date.now(),
        }];
      }
      return [];
    }),
  ]);

  // Log results for debugging
//   if (verbose) {
//     console.error(`[SNMP Parallel] Results for ${agent}:`);
//     console.error(`  v2c: ${v2cResult.status} - ${v2cResult.status === 'fulfilled' ? (Array.isArray(v2cResult.value) ? v2cResult.value.length + ' items' : 'not array') : (v2cResult as any).reason?.message || 'rejected'}`);
//     console.error(`  v1:  ${v1Result.status} - ${v1Result.status === 'fulfilled' ? (Array.isArray(v1Result.value) ? v1Result.value.length + ' items' : 'not array') : (v1Result as any).reason?.message || 'rejected'}`);
//     console.error(`  v3:  ${v3Result.status} - ${v3Result.status === 'fulfilled' ? (Array.isArray(v3Result.value) ? v3Result.value.length + ' items' : 'not array') : (v3Result as any).reason?.message || 'rejected'}`);
//   }

  // Aggregate results with priority: v2c > v1 > v3
  let bestResult: any = null;
  let bestVersion: 'v2c' | 'v1' | 'v3' | null = null;

  // Check v2c first (highest priority)
  if (v2cResult.status === 'fulfilled' && Array.isArray(v2cResult.value) && v2cResult.value.length > 0) {
    bestResult = v2cResult.value;
    bestVersion = 'v2c';
  }
  // Then v1
  else if (v1Result.status === 'fulfilled' && Array.isArray(v1Result.value) && v1Result.value.length > 0) {
    bestResult = v1Result.value;
    bestVersion = 'v1';
  }
  // Finally v3
  else if (v3Result.status === 'fulfilled' && Array.isArray(v3Result.value) && v3Result.value.length > 0) {
    bestResult = v3Result.value;
    bestVersion = 'v3';
  }

  if (verbose && !bestResult) {
    console.error(`[SNMP Parallel] No successful results for ${agent}`);
  }

  // If we have a best result, enhance it with info from other versions
  if (bestResult && Array.isArray(bestResult) && bestResult.length > 0) {
    const enhancedResult = { ...bestResult[0] };
    
    // Add version info to tags
    if (!enhancedResult.tags) {
      enhancedResult.tags = {};
    }
    enhancedResult.tags.snmp_best_version = bestVersion;

    // If v3 was successful, add its info as additional fields
    if (v3Result.status === 'fulfilled' && Array.isArray(v3Result.value) && v3Result.value.length > 0) {
      const v3Data = v3Result.value[0];
      if (v3Data && v3Data.fields) {
        // Add v3 fields with prefix
        if (!enhancedResult.fields) {
          enhancedResult.fields = {};
        }
        enhancedResult.fields.snmpv3_available = 1;
        enhancedResult.fields.snmpv3_enterprise = v3Data.fields.snmpv3_enterprise;
        enhancedResult.fields.snmpv3_enterprise_name = v3Data.fields.snmpv3_enterprise_name;
        enhancedResult.fields.snmpv3_engine_id_format = v3Data.fields.snmpv3_engine_id_format;
        enhancedResult.fields.snmpv3_engine_id_data = v3Data.fields.snmpv3_engine_id_data;
        enhancedResult.fields.snmpv3_engine_boots = v3Data.fields.snmpv3_engine_boots;
        enhancedResult.fields.snmpv3_engine_time = v3Data.fields.snmpv3_engine_time;
        enhancedResult.fields.snmpv3_engine_time_formatted = v3Data.fields.snmpv3_engine_time_formatted;
        enhancedResult.fields.snmpv3_engine_id_raw = v3Data.fields.snmpv3_engine_id_raw;
      }
    }

    // Add version attempt results
    if (!enhancedResult.fields) {
      enhancedResult.fields = {};
    }
    enhancedResult.fields.snmp_v2c_attempted = v2cResult.status === 'fulfilled';
    enhancedResult.fields.snmp_v2c_success = v2cResult.status === 'fulfilled' && Array.isArray(v2cResult.value) && v2cResult.value.length > 0;
    enhancedResult.fields.snmp_v1_attempted = v1Result.status === 'fulfilled';
    enhancedResult.fields.snmp_v1_success = v1Result.status === 'fulfilled' && Array.isArray(v1Result.value) && v1Result.value.length > 0;
    enhancedResult.fields.snmp_v3_attempted = v3Result.status === 'fulfilled';
    enhancedResult.fields.snmp_v3_success = v3Result.status === 'fulfilled' && Array.isArray(v3Result.value) && v3Result.value.length > 0;

    return [enhancedResult];
  }

  // If nothing worked, return empty array
  return [];
}

