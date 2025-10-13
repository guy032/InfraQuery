/**
 * SNMP Post-Processor
 * Enhances Telegraf's basic SNMP data with comprehensive OID walking
 * Uses native SNMP implementation to walk all wildcard OIDs
 */

import { deviceRegistry } from '../../lib/discovery/device-registry';
import { collectVendorOIDs } from './snmp-collector';
import oidPrefixesConfig from './snmp-oid-prefixes.json';
import { createV1V2Session, snmp as snmpModule, testSimpleOID } from './snmp-session';
import type {
  PrinterDetails,
  SnmpOptions,
  SnmpSession,
  SnmpVarbind,
  TelegrafMetric,
} from './types';
import { detectVendor } from './vendor-detection';

const ALL_OID_PREFIXES = oidPrefixesConfig.oid_prefixes.map((entry) => entry.oid);

/**
 * Remove redundant OID prefixes (children when parent exists)
 * Example: If '1.3.6.1.4.1.11' exists, skip '1.3.6.1.4.1.11.2.3.9'
 */
function removeRedundantPrefixes(prefixes: string[]): string[] {
  const sorted = [...prefixes].sort(); // Sort to ensure parents come before children
  const unique: string[] = [];

  for (const prefix of sorted) {
    // Check if any existing prefix is a parent of this one
    const hasParent = unique.some((existing) => prefix.startsWith(existing + '.'));

    if (!hasParent) {
      unique.push(prefix);
    }
  }

  return unique;
}

/**
 * Create SNMP session with appropriate credentials
 */
async function createSession(agent: string, options: SnmpOptions): Promise<SnmpSession | null> {
  const community = options.community || 'public';
  const timeout = 5000;
  const retries = 1;

  // Try v2c first
  try {
    const session = createV1V2Session(agent, community, snmpModule.Version2c, timeout, retries);
    const test = await testSimpleOID(session, 3000);

    if (test.success) {
      // console.log(`✓ Using SNMP v2c for ${agent}`);
      return session;
    }

    session.close();
  } catch {
    // Continue to v1
  }

  // Try v1
  try {
    const session = createV1V2Session(agent, community, snmpModule.Version1, timeout, retries);
    const test = await testSimpleOID(session, 3000);

    if (test.success) {
      // console.log(`✓ Using SNMP v1 for ${agent}`);
      return session;
    }

    session.close();
  } catch {
    // Failed
  }

  return null;
}

/**
 * Convert collected OID data to Telegraf metric format
 */
function convertToMetrics(
  _agent: string,
  oidData: SnmpVarbind[],
  baseTags: Record<string, string>,
): TelegrafMetric[] {
  const metrics: TelegrafMetric[] = [];

  // Debug: Check data collection
  // Create a single comprehensive metric with ALL collected OIDs
  const allFields: Record<string, any> = {};

  for (const item of oidData) {
    if (!item || !item.oid) {
      continue;
    }

    // Use full OID as field name
    const oidStr = String(item.oid);
    const fieldName = `oid_${oidStr.replaceAll('.', '_')}`;

    // Get and format value
    let value = item.value;

    // Convert buffers to appropriate format
    if (Buffer.isBuffer(value)) {
      // Check if it's likely binary data (contains non-printable characters)
      const isBinary = value.some((byte) => byte < 32 && byte !== 10 && byte !== 13 && byte !== 9);

      // Convert binary data to hex (MAC addresses), otherwise to UTF-8 string
      value =
        isBinary || value.length === 6
          ? value.toString('hex').toUpperCase().match(/.{2}/g)?.join(':') ||
            value.toString('hex').toUpperCase()
          : value.toString('utf8');
    }

    // Convert objects (from JSON serialization) to buffer then process
    if (typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data)) {
      const buffer = Buffer.from(value.data);
      const isBinary = buffer.some((byte) => byte < 32 && byte !== 10 && byte !== 13 && byte !== 9);

      // Convert binary data to hex (MAC addresses), otherwise to UTF-8 string
      value =
        isBinary || buffer.length === 6
          ? buffer.toString('hex').toUpperCase().match(/.{2}/g)?.join(':') ||
            buffer.toString('hex').toUpperCase()
          : buffer.toString('utf8');
    }

    // Keep ALL values - including null, empty, and zeros
    // This preserves the complete SNMP MIB tree structure
    if (value === null || value === undefined) {
      value = null; // Explicitly set to null for JSON compatibility
    }

    allFields[fieldName] = value;
  }

  // Create a single metric with all collected OIDs
  if (Object.keys(allFields).length > 0) {
    metrics.push({
      name: 'snmp',
      fields: allFields,
      tags: {
        ...baseTags,
        collection_type: 'vendor_oids',
      },
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  return metrics;
}

/**
 * Process a single agent's SNMP data
 */
async function processAgent(
  agent: string,
  metrics: TelegrafMetric[],
  options: SnmpOptions,
): Promise<TelegrafMetric[]> {
  // console.log(`\n📊 SNMP post-processor: Processing ${agent}`);

  // Check if we have basic SNMP system data
  const snmpMetric = metrics.find((m) => m.name === 'snmp');

  if (!snmpMetric || !snmpMetric.fields || !snmpMetric.fields.sysDescr) {
    console.log(`⚠️  No SNMP system data for ${agent}, skipping comprehensive collection`);

    // Return a copy to avoid reference issues when post-processor clears array
    return [...metrics];
  }

  // Try to create SNMP session for printer detection (optional)
  let session: SnmpSession | null = await createSession(agent, options);

  let isPrinter = false;
  const printerDetails: PrinterDetails = {};

  // Only try printer detection if session was created successfully
  if (session) {
    try {
      // Method 1: Actively check for Printer MIB (1.3.6.1.2.1.43) using getNext
      // This is the most reliable method - RFC 1759/3805 standard
      try {
        const printerMIBOid = '1.3.6.1.2.1.43';
        const getNextPromise = new Promise((resolve, reject) => {
          session!.getNext([printerMIBOid], (error, varbinds) => {
            if (error) {
              resolve(false);
            } else if (varbinds && varbinds.length > 0 && varbinds[0].oid) {
              // Check if the returned OID is still within the Printer MIB tree
              const returnedOid = varbinds[0].oid;
              const isPrinterMIB = returnedOid.startsWith(printerMIBOid + '.');
              resolve(isPrinterMIB);
            } else {
              resolve(false);
            }
          });
        });

        // Timeout after 3 seconds
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(false), 3000));
        const hasPrinterMIB = await Promise.race([getNextPromise, timeoutPromise]);

        if (hasPrinterMIB) {
          isPrinter = true;
          printerDetails.detectionMethod = 'Printer MIB (1.3.6.1.2.1.43)';
          console.log(`🖨️  Printer MIB detected for ${agent} via getNext`);
        }
      } catch {
        // Fallback: Check if Printer MIB OIDs were already collected
        const hasPrinterMIBInMetrics = metrics.some((metric) => {
          if (!metric.tags || !metric.tags.oid) {
            return false;
          }

          return metric.tags.oid.startsWith('1.3.6.1.2.1.43');
        });

        if (hasPrinterMIBInMetrics) {
          isPrinter = true;
          printerDetails.detectionMethod = 'Printer MIB (1.3.6.1.2.1.43)';
          console.log(`🖨️  Printer MIB detected for ${agent} from collected OIDs`);
        }
      }

      // Method 2: Check sysObjectID for known printer manufacturers (backup method)
      if (!isPrinter) {
        const sysObjectID = snmpMetric.fields.sysObjectID || snmpMetric.tags?.sysObjectID;

        if (sysObjectID) {
          const vendor = detectVendor(sysObjectID);

          if (vendor && vendor.name !== 'Unknown') {
            // All vendors in our VENDOR_PATTERNS are printer manufacturers
            isPrinter = true;
            printerDetails.vendor = vendor.name;
            printerDetails.sysObjectID = sysObjectID;
            printerDetails.detectionMethod = 'sysObjectID';
            console.log(`🖨️  Printer detected for ${agent} via sysObjectID (${vendor.name})`);
          }
        }
      }

      // Mark device as printer if detected by either method
      if (isPrinter) {
        deviceRegistry.markAsPrinter(agent, 'snmp', {
          ...printerDetails,
          sysDescr: snmpMetric.fields.sysDescr,
        });
        console.log(`✅ Device ${agent} registered as printer in device registry`);
        const stats = deviceRegistry.getStats();
        console.log(`📊 Printer registry now has ${stats.printers} printer(s) registered`);
      }
    } catch (detectionError) {
      console.log(`⚠️  Printer detection failed for ${agent}: ${detectionError.message}`);
    }
  } else {
    console.log(`⚠️  Skipping printer detection for ${agent} - no SNMP session available`);
  }

  // console.log(`✓ Found system info for ${agent}, collecting comprehensive OID data...`);

  // Remove redundant child OID prefixes (if parent is already in the list)
  const optimizedPrefixes = removeRedundantPrefixes(ALL_OID_PREFIXES);
  // console.log(`📋 Optimized ${ALL_OID_PREFIXES.length} OID prefixes to ${optimizedPrefixes.length} (removed redundant children)`);

  // Create session for comprehensive collection (always create fresh session)
  // Don't reuse printer detection session as it may be in bad state
  if (session) {
    // console.log(`🔄 Closing printer detection session for ${agent}...`);
    try {
      session.close();
    } catch {
      // Ignore errors closing old session
    }
  }

  // console.log(`📡 Creating fresh SNMP session for comprehensive OID collection for ${agent}...`);

  // Create session with proper configuration
  const community = options.community || 'public';
  const timeout = 10_000; // Longer timeout for walks
  const retries = 2;

  // Try v2c first (most common) - subtree() works with v2c
  session = createV1V2Session(agent, community, snmpModule.Version2c, timeout, retries);

  // Verify session works before attempting OID walks
  // console.log(`🧪 Testing SNMP session for ${agent}...`);
  const sessionTest = await testSimpleOID(session, 3000);

  if (sessionTest.success) {
    // console.log(`✅ SNMP v2c session verified for ${agent}`);
  } else {
    // console.log(`❌ SNMP session test failed: ${sessionTest.error}`);
    // console.log(`   Tried with community: ${community}, version: v2c`);

    // Try v1 fallback
    session.close();
    session = createV1V2Session(agent, community, snmpModule.Version1, timeout, retries);
    const v1Test = await testSimpleOID(session, 3000);

    if (!v1Test.success) {
      console.log(`❌ SNMP v1 also failed, skipping comprehensive collection`);
      session.close();

      // Return a copy to avoid reference issues when post-processor clears array
      return [...metrics];
    }
    // console.log(`✅ SNMP v1 session verified for ${agent}`);
  }

  try {
    // Collect all OID data
    // console.log(`📊 Starting comprehensive OID collection for ${agent}...`);
    // console.log(`   Prefixes to walk: ${optimizedPrefixes.length}`);

    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      // console.log(`⏰ OID collection timeout for ${agent} (60s limit reached)`);
      abortController.abort();
    }, 60_000); // 60s timeout for all OIDs

    const collectedData = await collectVendorOIDs(
      session,
      optimizedPrefixes,
      abortController.signal,
    );
    clearTimeout(timeout);

    // console.log(`✅ OID collection completed for ${agent}: ${collectedData.length} OIDs collected`);

    // console.log(`✅ Collected ${collectedData.length} total OIDs (with potential duplicates) for ${agent}`);

    // Deduplicate OIDs (some prefixes overlap, causing same OID to be collected multiple times)
    const uniqueOids = new Map();

    for (const item of collectedData) {
      if (item && item.oid) {
        uniqueOids.set(item.oid, item); // Last occurrence wins
      }
    }

    const deduplicatedData = [...uniqueOids.values()];
    // console.log(`📊 After deduplication: ${deduplicatedData.length} unique OIDs`);

    if (deduplicatedData.length === 0) {
      // console.log(`⚠️  No additional data collected for ${agent}`);
      // Return a copy to avoid reference issues when post-processor clears array
      return [...metrics];
    }

    // Convert collected data to metric format
    const additionalMetrics = convertToMetrics(agent, deduplicatedData, snmpMetric.tags);

    // Merge with original metrics
    return [...metrics, ...additionalMetrics];
  } finally {
    // Only close session if it exists and is still running
    if (session) {
      try {
        session.close();
      } catch {
        // Session might already be closed, ignore
      }
    }
  }
}

/**
 * Main post-processor function
 */
export async function snmpPostProcessor(
  agent: string,
  port: number,
  options: SnmpOptions,
  metrics: TelegrafMetric[],
): Promise<void> {
  try {
    const additionalMetrics = await processAgent(agent, metrics, options);

    // Add collected metrics to the array
    if (additionalMetrics && additionalMetrics.length > 0) {
      // Remove original metrics first (we'll replace with enhanced version)
      metrics.length = 0;
      metrics.push(...additionalMetrics);
    }
  } catch (error) {
    console.error(`❌ SNMP post-processor error for ${agent}:`, error.message);
    // Leave original metrics unchanged on error
  }
}
