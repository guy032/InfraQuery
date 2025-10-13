/**
 * SNMPv3 Discovery
 * Efficiently discovers SNMPv3 devices and extracts enterprise information
 * Similar to Shodan's SNMPv3 detection - no authentication required
 */

import * as asn1 from 'asn1.js';
import * as dgram from 'dgram';

import ENTERPRISE_NAMES from '../../../data/iana-enterprise-numbers.json';

// Engine ID format types (RFC 3411)
const ENGINE_ID_FORMATS: Record<number, string> = {
  /* eslint-disable @typescript-eslint/naming-convention */
  0: 'reserved',
  1: 'ipv4',
  2: 'ipv6',
  3: 'mac',
  4: 'text',
  5: 'octets',
  /* eslint-enable @typescript-eslint/naming-convention */
};

/**
 * SNMPv3 discovery result
 */
export interface ISnmpV3DiscoveryResult {
  success: boolean;
  enterprise?: number;
  enterpriseName?: string;
  engineIDFormat?: string;
  engineIDData?: string;
  engineBoots?: number;
  engineTime?: number;
  engineTimeFormatted?: string;
  raw?: string;
  error?: string;
}

/**
 * Parsed engine ID information
 */
interface IEngineIDInfo {
  format: number | null;
  formatName: string;
  enterprise: number | null;
  enterpriseName: string | null;
  data: string | null;
  raw: string;
}

// Define ASN.1 structures for SNMPv3
/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-invalid-this, @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
const SNMPMessage = asn1.define('SNMPMessage', function (this: any) {
  // eslint-disable-next-line no-invalid-this
  return this.seq().obj(
    // eslint-disable-next-line no-invalid-this
    this.key('version').int(),
    // eslint-disable-next-line no-invalid-this
    this.key('msgGlobalData').seq().obj(
      // eslint-disable-next-line no-invalid-this
      this.key('msgID').int(),
      // eslint-disable-next-line no-invalid-this
      this.key('msgMaxSize').int(),
      // eslint-disable-next-line no-invalid-this
      this.key('msgFlags').octstr(),
      // eslint-disable-next-line no-invalid-this
      this.key('msgSecurityModel').int(),
    ),
    // eslint-disable-next-line no-invalid-this
    this.key('msgSecurityParameters').octstr(),
    // eslint-disable-next-line no-invalid-this
    this.key('msgData').any(),
  );
});

const USMSecurityParameters = asn1.define('UsmSecurityParameters', function (this: any) {
  // eslint-disable-next-line no-invalid-this
  return this.seq().obj(
    // eslint-disable-next-line no-invalid-this
    this.key('msgAuthoritativeEngineID').octstr(),
    // eslint-disable-next-line no-invalid-this
    this.key('msgAuthoritativeEngineBoots').int(),
    // eslint-disable-next-line no-invalid-this
    this.key('msgAuthoritativeEngineTime').int(),
    // eslint-disable-next-line no-invalid-this
    this.key('msgUserName').octstr(),
    // eslint-disable-next-line no-invalid-this
    this.key('msgAuthenticationParameters').octstr(),
    // eslint-disable-next-line no-invalid-this
    this.key('msgPrivacyParameters').octstr(),
  );
});
/* eslint-enable @typescript-eslint/naming-convention, @typescript-eslint/no-explicit-any */
/* eslint-enable @typescript-eslint/no-invalid-this, @typescript-eslint/no-unsafe-return */
/* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

/**
 * Parse SNMPv3 Engine ID according to RFC 3411
 * This function handles multiple engine ID formats and enterprise IDs
 */
function parseEngineID(engineIDBuffer: Buffer): IEngineIDInfo {
  const result: IEngineIDInfo = {
    format: null,
    formatName: 'unknown',
    enterprise: null,
    enterpriseName: null,
    data: null,
    raw: engineIDBuffer.toString('hex'),
  };

  if (engineIDBuffer.length < 5) {
    return result;
  }

  // First 4 bytes are enterprise ID (big-endian)
  let enterprise = engineIDBuffer.readUInt32BE(0);

  // Check if high bit is set (RFC 3411 format)
  if (enterprise > 0x80_00_00_00) {
    enterprise = enterprise - 0x80_00_00_00;
    result.enterprise = enterprise;
    result.enterpriseName = ENTERPRISE_NAMES[enterprise] || `Enterprise-${enterprise}`;

    // Byte 5 is the format
    const format = engineIDBuffer[4];

    result.format = format;
    result.formatName = ENGINE_ID_FORMATS[format] || 'unknown';

    // Remaining bytes (from byte 6 onwards) are engine-specific data
    const dataBytes = engineIDBuffer.subarray(5);

    // Format 1 = IPv4
    if (format === 1 && dataBytes.length >= 4) {
      result.data = [...dataBytes.subarray(0, 4)].join('.');
    }
    // Format 2 = IPv6
    else if (format === 2 && dataBytes.length >= 16) {
      const ipv6Parts: string[] = [];

      for (let i = 0; i < 16; i += 2) {
        ipv6Parts.push(dataBytes.readUInt16BE(i).toString(16));
      }

      result.data = ipv6Parts.join(':');
    }
    // Format 3 = MAC address
    else if (format === 3 && dataBytes.length >= 6) {
      const macBytes = dataBytes.subarray(0, 6);

      result.data = [...macBytes].map((b) => b.toString(16).padStart(2, '0')).join(':');
    }
    // Format 4 = Text
    else if (format === 4) {
      result.data = dataBytes.toString('ascii');
    }
    // Format 5 = Octets
    else if (format === 5) {
      result.data = dataBytes.toString('hex');
    } else {
      result.data = dataBytes.toString('hex');
    }
  } else {
    // Non-RFC 3411 format (older/proprietary)
    result.enterprise = enterprise;
    result.enterpriseName = ENTERPRISE_NAMES[enterprise] || `Enterprise-${enterprise}`;
    result.formatName = 'unknown';
    result.data = engineIDBuffer.subarray(4).toString('hex');
  }

  return result;
}

/**
 * Format engine time in human-readable format
 */
function formatEngineTime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  // Format: "73 days, 0:40:02"
  return `${days} days, ${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Create SNMPv3 discovery message
 * This is a minimal probe that doesn't require authentication
 */
function createDiscoveryMessage(): Buffer {
  // First, encode the USM security parameters (all empty/zero for discovery)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const usmParams = USMSecurityParameters.encode(
    {
      msgAuthoritativeEngineID: Buffer.alloc(0),
      msgAuthoritativeEngineBoots: 0,
      msgAuthoritativeEngineTime: 0,
      msgUserName: Buffer.alloc(0),
      msgAuthenticationParameters: Buffer.alloc(0),
      msgPrivacyParameters: Buffer.alloc(0),
    },
    'der',
  );

  // Construct the full SNMPv3 message
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  return SNMPMessage.encode(
    {
      version: 3, // SNMPv3
      msgGlobalData: {
        msgID: 0x4a_69, // Standard msgID used by Nmap
        msgMaxSize: 0xff_e3, // 65507
        msgFlags: Buffer.from([0x04]), // reportable flag set for discovery
        msgSecurityModel: 3, // USM (User-based Security Model)
      },
      msgSecurityParameters: usmParams,
      // Minimal PDU (from Nmap's SNMPv3GetRequest probe)
      msgData: Buffer.from([
        0xa0, 0x0c, 0x02, 0x02, 0x37, 0xf0, 0x02, 0x01, 0x00, 0x02, 0x01, 0x00, 0x30, 0x00,
      ]),
    },
    'der',
  ) as Buffer;
}

/**
 * Discover SNMPv3 device information
 * Sends a discovery probe and parses the response
 */
export async function discoverSNMPv3(ip: string, timeout = 5000): Promise<ISnmpV3DiscoveryResult> {
  return new Promise<ISnmpV3DiscoveryResult>((resolve) => {
    const socket = dgram.createSocket('udp4');
    let isResponseReceived = false;

    // Create discovery message
    const message = createDiscoveryMessage();

    // Set timeout
    const timeoutId = setTimeout(() => {
      if (!isResponseReceived) {
        socket.close();
        resolve({
          success: false,
          error: 'Timeout - no response received',
        });
      }
    }, timeout);

    // Handle response
    socket.on('message', (msg: Buffer, _rinfo: dgram.RemoteInfo) => {
      if (isResponseReceived) {
        return;
      }

      isResponseReceived = true;

      clearTimeout(timeoutId);

      try {
        // Decode outer SNMP message
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const decoded = SNMPMessage.decode(msg, 'der');

        // Convert BN (BigNumber) objects to regular numbers
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const version = decoded.version.toNumber();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const msgID = decoded.msgGlobalData.msgID.toNumber();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const msgSecurityModel = decoded.msgGlobalData.msgSecurityModel.toNumber();

        // Validate response
        if (version !== 3) {
          socket.close();
          resolve({
            success: false,
            error: `Not SNMPv3 (version ${version})`,
          });

          return;
        }

        if (msgID !== 0x4a_69) {
          socket.close();
          resolve({
            success: false,
            error: `msgID mismatch: expected 0x4a69, got 0x${msgID.toString(16)}`,
          });

          return;
        }

        // Check for User-based Security Model (USM)
        if (msgSecurityModel !== 3) {
          socket.close();
          resolve({
            success: false,
            error: 'Not using User-based Security Model (USM)',
          });

          return;
        }

        // Decode USM security parameters
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (decoded.msgSecurityParameters && decoded.msgSecurityParameters.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const usmParams = USMSecurityParameters.decode(decoded.msgSecurityParameters, 'der');

          // Convert BN objects to numbers
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const engineBoots = usmParams.msgAuthoritativeEngineBoots.toNumber();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const engineTime = usmParams.msgAuthoritativeEngineTime.toNumber();

          // Parse engine ID
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const engineInfo = parseEngineID(usmParams.msgAuthoritativeEngineID);

          socket.close();
          resolve({
            success: true,
            enterprise: engineInfo.enterprise || undefined,
            enterpriseName: engineInfo.enterpriseName || undefined,
            engineIDFormat: engineInfo.formatName,
            engineIDData: engineInfo.data || undefined,
            engineBoots,
            engineTime,
            engineTimeFormatted: formatEngineTime(engineTime),
            raw: engineInfo.raw,
          });
        } else {
          socket.close();
          resolve({
            success: false,
            error: 'No security parameters in response',
          });
        }
      } catch (error) {
        socket.close();
        resolve({
          success: false,
          error: `Decode error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    });

    // Handle socket errors
    socket.on('error', (err) => {
      if (!isResponseReceived) {
        isResponseReceived = true;
        clearTimeout(timeoutId);
        socket.close();
        resolve({
          success: false,
          error: `Socket error: ${err.message}`,
        });
      }
    });

    // Send the discovery message
    socket.send(message, 161, ip, (err) => {
      if (err) {
        isResponseReceived = true;
        clearTimeout(timeoutId);
        socket.close();
        resolve({
          success: false,
          error: `Send error: ${err.message}`,
        });
      }
    });
  });
}

/**
 * Quick SNMPv3 detection (just checks if device responds)
 */
export async function detectSNMPv3(ip: string, timeout = 3000): Promise<boolean> {
  const result = await discoverSNMPv3(ip, timeout);

  return result.success;
}
