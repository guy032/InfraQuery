/**
 * SNMP Data Collection
 * Walks OID trees and collects comprehensive device data
 */

import type { SnmpSession, SnmpVarbind } from './types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const snmp = require('net-snmp');

/**
 * Walk an OID subtree and collect all values
 * Uses subtree() for SNMPv2c/v3 (GETBULK) which is more efficient
 */
export async function walkOID(
  session: SnmpSession,
  oid: string,
  signal?: AbortSignal,
): Promise<SnmpVarbind[]> {
  return new Promise<SnmpVarbind[]>((resolve, reject) => {
    const results: SnmpVarbind[] = [];
    let aborted = false;

    if (signal) {
      signal.addEventListener('abort', () => {
        aborted = true;
        resolve(results); // Return partial results
      });
    }

    const maxPerSession = 10_000;

    const onVarbinds = (varbinds: any[]): void => {
      if (aborted) {
        return;
      }

      // varbinds is an array of {oid, type, value} objects
      for (const varbind of varbinds) {
        if (snmp.isVarbindError(varbind)) {
          continue; // Skip errors
        }

        // net-snmp varbind structure: {oid: string, type: number, value: any}
        results.push({
          oid: varbind.oid, // OID string
          type: varbind.type, // SNMP type
          value: varbind.value, // Value
        });

        if (results.length >= maxPerSession) {
          session.close();

          return;
        }
      }
    };

    // Use subtree() instead of walk() for v2c/v3 - more efficient and reliable
    // maxRepetitions: 20 means get up to 20 OIDs per request
    session.subtree(oid, 20, onVarbinds, (error: Error | null) => {
      if (aborted) {
        resolve(results);
      } else if (error) {
        // Log error details for debugging
        // console.log(`  SNMP subtree error for ${oid}: ${error.message || error.toString()}`);
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

/**
 * Get a single OID
 */
async function getSingleOID(
  session: SnmpSession,
  oid: string,
  timeout = 3000,
): Promise<SnmpVarbind | null> {
  return new Promise<SnmpVarbind | null>((resolve) => {
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      resolve(null);
    }, timeout);

    session.get([oid], (error, varbinds) => {
      if (timedOut) {
        return;
      }

      clearTimeout(timeoutId);

      if (error) {
        resolve(null);
      } else if (varbinds && varbinds.length > 0 && !snmp.isVarbindError(varbinds[0])) {
        resolve({
          oid: varbinds[0].oid,
          type: varbinds[0].type,
          value: varbinds[0].value,
        });
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Get specific OIDs - requests them one at a time for better compatibility
 * Some devices (especially PDUs) don't support bulk OID requests
 */
export async function getOIDs(
  session: SnmpSession,
  oids: string[],
  timeout = 5000,
): Promise<SnmpVarbind[]> {
  const results: SnmpVarbind[] = [];
  const timeoutPerOID = Math.min(timeout / oids.length, 3000); // Max 3s per OID

  for (const oid of oids) {
    const result = await getSingleOID(session, oid, timeoutPerOID);

    if (result) {
      results.push(result);
    }
  }

  return results;
}

/**
 * Collect data from multiple OID prefixes (vendor-specific)
 */
export async function collectVendorOIDs(
  session: SnmpSession,
  oidPrefixes: string[],
  signal?: AbortSignal,
): Promise<SnmpVarbind[]> {
  const allResults: SnmpVarbind[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const oidPrefix of oidPrefixes) {
    if (signal && signal.aborted) {
      // console.log(`⚠️  OID collection aborted after ${successCount} successful walks`);
      break;
    }

    try {
      const results = await walkOID(session, oidPrefix, signal);

      if (results && results.length > 0) {
        allResults.push(...results);
        successCount++;
        // console.log(`✓ Walked ${oidPrefix}: ${results.length} OIDs`);
      } else {
        failCount++;
        // console.log(`  Empty walk for ${oidPrefix}`);
      }
    } catch {
      failCount++;
      // console.log(`✗ Failed to walk ${oidPrefix}: ${error.message}`);
      // Continue with next OID
    }
  }

  // console.log(`📊 OID walk summary: ${successCount} successful, ${failCount} failed/empty`);
  return allResults;
}

/**
 * Check if buffer contains printable ASCII characters
 */
function isPrintableBuffer(buffer: Buffer): boolean {
  if (buffer.length === 0) {
    return false;
  }

  // Allow printable ASCII (32-126) plus common whitespace (9, 10, 13)
  for (const byte of buffer) {
    if ((byte < 32 || byte > 126) && byte !== 9 && byte !== 10 && byte !== 13) {
      return false;
    }
  }

  return true;
}

/**
 * Convert buffer to hex string with optional separator
 */
function bufferToHex(buffer: Buffer, separator = ':'): string {
  return [...buffer].map((byte) => byte.toString(16).padStart(2, '0')).join(separator);
}

/**
 * Format varbind value based on type
 */
export function formatValue(varbind: SnmpVarbind): string | number {
  if (!varbind || varbind.value === null || varbind.value === undefined) {
    return '';
  }

  const type = varbind.type;
  const value = varbind.value;

  // Handle different SNMP types
  switch (type) {
    case snmp.ObjectType.OctetString: {
      if (Buffer.isBuffer(value)) {
        // Check if it looks like a MAC address (6 bytes)
        if (value.length === 6) {
          return bufferToHex(value, ':');
        }

        // Check if it's printable text
        if (isPrintableBuffer(value)) {
          return value.toString('utf8').trim();
        }

        // Otherwise, return as hex
        return bufferToHex(value, ' ');
      }

      return String(value);
    }

    case snmp.ObjectType.Integer:
    case snmp.ObjectType.Counter:
    case snmp.ObjectType.Gauge:
    case snmp.ObjectType.TimeTicks:

    // eslint-disable-next-line no-fallthrough
    case snmp.ObjectType.Counter64: {
      return Number(value);
    }

    case snmp.ObjectType.IpAddress: {
      if (Buffer.isBuffer(value)) {
        return [...value].join('.');
      }

      return String(value);
    }

    case snmp.ObjectType.OID: {
      return String(value);
    }
    // No default
  }

  return String(value);
}
