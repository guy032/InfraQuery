/**
 * SNMP Protocol Discovery Implementation
 *
 * Native JavaScript implementation for discovering SNMP-enabled devices
 * Collects system info + walks vendor-specific OID trees
 */

import log from '../../lib/infrastructure/logger';
import { collectVendorOIDs, formatValue, getOIDs } from './snmp-collector';
import { createV1V2Session, testSimpleOID } from './snmp-session';
import type { SnmpSession, SnmpVarbind } from './types';
import { detectVendor, getVendorOIDs } from './vendor-detection';

/**
 * SNMP discovery options
 */
export interface SnmpDiscoveryOptions {
  version?: number; // 1 or 2
  community?: string;
  timeout?: number;
  retries?: number;
  collectVendorData?: boolean; // Whether to collect vendor-specific OIDs
}

/**
 * Standard SNMP system OIDs
 */
const SYSTEM_OIDS = {
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysObjectID: '1.3.6.1.2.1.1.2.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  sysContact: '1.3.6.1.2.1.1.4.0',
  sysName: '1.3.6.1.2.1.1.5.0',
  sysLocation: '1.3.6.1.2.1.1.6.0',
  sysServices: '1.3.6.1.2.1.1.7.0',
};

/**
 * Common OID prefixes to walk
 */
const COMMON_OID_PREFIXES = [
  '1.3.6.1.2.1.2.2', // Interface Table
  '1.3.6.1.2.1.4.22', // ARP Table
];

/**
 * SNMP discovery function for network scanner
 * @param {string} agent - Target IP address
 * @param {number} port - SNMP port (default 161)
 * @param {SnmpDiscoveryOptions} options - Discovery options
 * @returns {Promise<Array>} Array of metrics in Telegraf JSON format
 */
export async function discover(
  agent: string,
  port = 161,
  options: SnmpDiscoveryOptions = {},
): Promise<unknown[]> {
  const {
    version = 2,
    community = 'public',
    timeout = 3000,
    retries = 1,
    collectVendorData = true,
  } = options;

  let session: SnmpSession | null = null;
  let actualVersion = version;

  try {
    // Try v2c first if that's what was requested
    if (version === 2) {
      session = createV1V2Session(agent, community, 2, timeout, retries);
      const testResult = await testSimpleOID(session, timeout);

      if (!testResult.success) {
        // v2c failed, try v1 fallback
        log.verbose(`SNMP v2c test failed for ${agent}: ${testResult.error || 'Unknown error'}`);
        session.close();
        session = createV1V2Session(agent, community, 1, timeout, retries);
        const v1Test = await testSimpleOID(session, timeout);

        if (!v1Test.success) {
          // Both versions failed
          log.verbose(`SNMP v1 test also failed for ${agent}: ${v1Test.error || 'Unknown error'}`);
          session.close();

          return [];
        }

        // v1 succeeded
        actualVersion = 1;
        log.verbose(`SNMP v2c failed for ${agent}, using v1 fallback`);
      }
    } else {
      // v1 was explicitly requested
      session = createV1V2Session(agent, community, 1, timeout, retries);
      const testResult = await testSimpleOID(session, timeout);

      if (!testResult.success) {
        log.verbose(`SNMP v1 test failed for ${agent}: ${testResult.error || 'Unknown error'}`);

        return [];
      }
    }

    // Collect system information
    const systemOids = Object.values(SYSTEM_OIDS);
    log.verbose(`Collecting system OIDs for ${agent} using SNMPv${actualVersion}`);
    const systemData = await getOIDs(session, systemOids, timeout);

    if (!systemData || systemData.length === 0) {
      log.verbose(
        `No system data collected for ${agent} (${systemData?.length || 0} OIDs returned)`,
      );

      return [];
    }

    log.verbose(`Successfully collected ${systemData.length} system OIDs for ${agent}`);

    // Parse system information
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const deviceInfo = parseSystemData(systemData);

    // Detect vendor from sysObjectID
    const sysObjectID = deviceInfo.sysObjectID || '';
    const vendorInfo = detectVendor(sysObjectID);

    // Collect vendor-specific and common OID data if enabled
    const allOidData: SnmpVarbind[] = [];

    if (collectVendorData) {
      // Get vendor-specific OID prefixes
      const vendorOidPrefixes = vendorInfo ? getVendorOIDs(vendorInfo.id) : [];

      // Combine vendor OIDs with common OIDs
      const oidPrefixes = [...vendorOidPrefixes, ...COMMON_OID_PREFIXES];

      if (oidPrefixes.length > 0) {
        try {
          // Walk all OID prefixes (with abort signal for timeout)
          const abortController = new AbortController();
          const timeoutId = setTimeout(() => abortController.abort(), 10_000); // 10s max for walks

          const oidData = await collectVendorOIDs(session, oidPrefixes, abortController.signal);
          clearTimeout(timeoutId);

          if (oidData && oidData.length > 0) {
            allOidData.push(...oidData);
          }
        } catch (error) {
          const err = error as Error;
          log.debug(`OID walk error for ${agent}: ${err.message}`);
          // Continue anyway with system data
        }
      }
    }

    // Convert all OID data to key-value metrics
    const oidMetrics: Record<string, number | string> = {};

    for (const varbind of allOidData) {
      const key = varbind.oid;
      const value = formatValue(varbind);

      if (value !== null && value !== undefined && value !== '') {
        oidMetrics[key] = value;
      }
    }

    // Build device metadata
    const deviceMetadata = {
      type: 'network_device',
      vendor: vendorInfo?.name || 'Unknown',
      vendorId: vendorInfo?.id || undefined,
      role: 'snmp_device',
      port,
      version: actualVersion,
      community, // Include for reference (security consideration)

      // System information
      sysDescr: deviceInfo.sysDescr || undefined,
      sysObjectID: deviceInfo.sysObjectID || undefined,
      sysName: deviceInfo.sysName || undefined,
      sysLocation: deviceInfo.sysLocation || undefined,
      sysContact: deviceInfo.sysContact || undefined,
      sysUpTime: deviceInfo.sysUpTime || undefined,
      sysServices: deviceInfo.sysServices || undefined,

      // OID collection stats
      oidCount: allOidData.length,
      vendorOidsCollected: vendorInfo ? getVendorOIDs(vendorInfo.id).length : 0,
    };

    // Build field values - include system info + all OID metrics
    const fields: Record<string, number | string> = {
      available: 1,
      snmp_service: 1,
      version: actualVersion,
      oid_count: allOidData.length,
      ...oidMetrics, // Include all collected OID data as fields
    };

    // Add system fields if available
    if (deviceInfo.sysUpTime !== undefined) {
      fields.sysUpTime = deviceInfo.sysUpTime;
    }

    if (deviceInfo.sysServices !== undefined) {
      fields.sysServices = deviceInfo.sysServices;
    }

    if (deviceInfo.sysDescr) {
      fields.sysDescr = deviceInfo.sysDescr;
    }

    if (deviceInfo.sysName) {
      fields.sysName = deviceInfo.sysName;
    }

    if (deviceInfo.sysObjectID) {
      fields.sysObjectID = deviceInfo.sysObjectID;
    }

    // Return metrics in Telegraf JSON format
    return [
      {
        fields,
        name: 'snmp',
        tags: {
          agent,
          protocol: 'snmp',
          port: String(port),
          version: `v${actualVersion}${actualVersion === 1 ? '' : 'c'}`,
          vendor: vendorInfo?.name || 'Unknown',
          sys_name: deviceInfo.sysName || 'unknown',
          // Device identification metadata
          _device_info: JSON.stringify(deviceMetadata),
        },
        timestamp: Math.floor(Date.now() / 1000),
      },
    ];
  } catch (error) {
    const err = error as Error;
    log.debug(`SNMP discovery failed for ${agent}:${port} - ${err.message}`);

    // Return empty array on error (fail silently)
    return [];
  } finally {
    // Clean up session
    if (session) {
      try {
        session.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

/**
 * Parse SNMP system data from varbinds
 */
function parseSystemData(varbinds: SnmpVarbind[]): {
  sysDescr?: string;
  sysObjectID?: string;
  sysUpTime?: number;
  sysContact?: string;
  sysName?: string;
  sysLocation?: string;
  sysServices?: number;
} {
  const result: any = {};

  for (const varbind of varbinds) {
    const { oid, value } = varbind;

    switch (oid) {
      case SYSTEM_OIDS.sysDescr: {
        result.sysDescr = value ? value.toString() : undefined;
        break;
      }

      case SYSTEM_OIDS.sysObjectID: {
        result.sysObjectID = value ? value.toString() : undefined;
        break;
      }

      case SYSTEM_OIDS.sysUpTime: {
        result.sysUpTime = value ? Number(value) : undefined;
        break;
      }

      case SYSTEM_OIDS.sysContact: {
        result.sysContact = value ? value.toString() : undefined;
        break;
      }

      case SYSTEM_OIDS.sysName: {
        result.sysName = value ? value.toString() : undefined;
        break;
      }

      case SYSTEM_OIDS.sysLocation: {
        result.sysLocation = value ? value.toString() : undefined;
        break;
      }

      case SYSTEM_OIDS.sysServices: {
        result.sysServices = value ? Number(value) : undefined;
        break;
      }
      // No default
    }
  }

  return result;
}
