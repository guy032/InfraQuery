/**
 * SNMP Session Management
 * Handles SNMP v1, v2c, and v3 session creation and testing
 */

import type { SnmpSession, SnmpTestResult, SnmpV3Profile } from './types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const snmp = require('net-snmp');

/**
 * Create SNMP v1/v2c session
 */
export function createV1V2Session(
  ip: string,
  community: string,
  version: number,
  timeout = 3000,
  retries = 1,
): SnmpSession {
  // Convert numeric version to snmp constant
  const snmpVersion = version === 1 ? snmp.Version1 : snmp.Version2c;

  return snmp.createSession(ip, community, {
    port: 161,
    retries,
    timeout,
    version: snmpVersion,
  });
}

/**
 * Create SNMP v3 session
 */
export function createV3Session(
  ip: string,
  profile: SnmpV3Profile,
  timeout = 3000,
  retries = 1,
): SnmpSession {
  const options: any = {
    port: 161,
    retries,
    timeout,
    version: snmp.Version3,
    user: profile.user,
  };

  // Add authentication if provided
  if (profile.authProtocol && profile.authKey) {
    options.authProtocol = profile.authProtocol;
    options.authKey = profile.authKey;
  }

  // Add privacy if provided
  if (profile.privProtocol && profile.privKey) {
    options.privProtocol = profile.privProtocol;
    options.privKey = profile.privKey;
  }

  return snmp.createV3Session(ip, options.user, options);
}

/**
 * Test a simple OID to verify SNMP connectivity
 */
export async function testSimpleOID(session: SnmpSession, timeout = 3000): Promise<SnmpTestResult> {
  return new Promise<SnmpTestResult>((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve({ success: false, error: 'Timeout' });
    }, timeout);

    // Test with sysDescr (1.3.6.1.2.1.1.1.0)
    session.get(['1.3.6.1.2.1.1.1.0'], (error, varbinds) => {
      clearTimeout(timeoutId);

      if (error) {
        resolve({ success: false, error: error.message });
      } else if (varbinds && varbinds.length > 0 && !snmp.isVarbindError(varbinds[0])) {
        resolve({
          success: true,
          varbind: {
            oid: varbinds[0].oid,
            type: varbinds[0].type,
            value: varbinds[0].value.toString(),
          },
        });
      } else {
        resolve({ success: false, error: 'Invalid response' });
      }
    });
  });
}

/**
 * Test GetBulk functionality (v2c/v3 only)
 */
export async function testGetBulk(session: SnmpSession, timeout = 3000): Promise<SnmpTestResult> {
  return new Promise<SnmpTestResult>((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve({ success: false, error: 'Timeout' });
    }, timeout);

    // Test GetBulk with system OIDs
    session.getBulk(['1.3.6.1.2.1.1'], 0, 5, (error, varbinds) => {
      clearTimeout(timeoutId);

      if (error) {
        resolve({ success: false, error: error.message });
      } else if (varbinds && varbinds.length > 0) {
        resolve({
          success: true,
          bulkCount: varbinds.length,
        });
      } else {
        resolve({ success: false, error: 'No bulk response' });
      }
    });
  });
}

// Export snmp module for version constants
export { snmp };
