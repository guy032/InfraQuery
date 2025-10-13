/**
 * OPC-UA Device Identification (Post-Processor)
 *
 * Enhances Telegraf OPC-UA metrics with device identification.
 * Similar to Modbus post-processor pattern.
 */

import type { OpcUaDeviceInfo } from './types';

// Suppress OPC-UA library verbose logging BEFORE any imports
process.env.DEBUG = '';
process.env.NODEOPCUADEBUG = '';
process.env.NODEOPCUA_DEBUG = '';

// Immediately suppress the RSA warnings and time discrepancy logs
const originalStdout = process.stdout.write.bind(process.stdout);
const originalStderr = process.stderr.write.bind(process.stderr);

process.stdout.write = function (chunk: any, encoding?: any, callback?: any): boolean {
  if (
    typeof chunk === 'string' &&
    (chunk.includes('verify_pcks1') ||
      chunk.includes('NODE-OPCUA-W') ||
      chunk.includes('security-revert') ||
      chunk.includes('remote server clock') ||
      chunk.includes('server time :') ||
      chunk.includes('client time :') ||
      chunk.includes('transaction duration') ||
      chunk.includes('server URL =') ||
      chunk.includes('token.createdAt') ||
      chunk.includes('client_secure_channel_layer') ||
      chunk.includes(' ...                                                ') ||
      chunk.trim().startsWith('...'))
  ) {
    if (callback) {
      callback();
    }

    return true;
  }

  return originalStdout(chunk, encoding, callback);
} as typeof process.stdout.write;

process.stderr.write = function (chunk: any, encoding?: any, callback?: any): boolean {
  if (
    typeof chunk === 'string' &&
    (chunk.includes('verify_pcks1') ||
      chunk.includes('NODE-OPCUA-W') ||
      chunk.includes('security-revert') ||
      chunk.includes('client_secure_channel_layer') ||
      /\d{2}:\d{2}:\d{2}\.\d{3}Z\s*:/.test(chunk)) // Timestamp pattern
  ) {
    if (callback) {
      callback();
    }

    return true;
  }

  return originalStderr(chunk, encoding, callback);
} as typeof process.stderr.write;

// eslint-disable-next-line @typescript-eslint/no-var-requires
import log from '../../lib/infrastructure/logger';

// Check if node-opcua is available
let opcua: any;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  opcua = require('node-opcua');
  // Keep suppression active - don't restore
} catch {
  log.verbose('node-opcua module not found for device identification');
  // Keep suppression active even on error
}

/**
 * Timeout wrapper for promises
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs),
    ),
  ]);
}

/**
 * Temporarily suppress console and stream output during OPC-UA operations
 */
function suppressOpcUaLogging() {
  // Already suppressed at module level, but ensure it stays suppressed
  process.stdout.write = function (chunk: any, encoding?: any, callback?: any): boolean {
    if (
      typeof chunk === 'string' &&
      (chunk.includes('verify_pcks1') ||
        chunk.includes('NODE-OPCUA-W') ||
        chunk.includes('security-revert') ||
        chunk.includes('remote server clock') ||
        chunk.includes('server time :') ||
        chunk.includes('client time :') ||
        chunk.includes('transaction duration') ||
        chunk.includes('server URL =') ||
        chunk.includes('token.createdAt') ||
        chunk.includes('client_secure_channel_layer') ||
        chunk.includes(' ...                                                ') ||
        chunk.trim().startsWith('...'))
    ) {
      if (callback) {
        callback();
      }

      return true;
    }

    return originalStdout(chunk, encoding, callback);
  } as typeof process.stdout.write;

  process.stderr.write = function (chunk: any, encoding?: any, callback?: any): boolean {
    if (
      typeof chunk === 'string' &&
      (chunk.includes('verify_pcks1') ||
        chunk.includes('NODE-OPCUA-W') ||
        chunk.includes('security-revert') ||
        chunk.includes('client_secure_channel_layer') ||
        /\d{2}:\d{2}:\d{2}\.\d{3}Z\s*:/.test(chunk)) // Timestamp pattern
    ) {
      if (callback) {
        callback();
      }

      return true;
    }

    return originalStderr(chunk, encoding, callback);
  } as typeof process.stderr.write;
}

/**
 * Restore normal logging
 */
function restoreLogging() {
  process.stdout.write = originalStdout;
  process.stderr.write = originalStderr;
}

/**
 * OPC-UA Device Identification Discovery
 * Retrieves device identification from OPC-UA server
 */
export class OpcUaDeviceIdentification {
  private ip: string;

  private port: number;

  constructor(ip: string, port = 4840) {
    this.ip = ip;
    this.port = port;
  }

  /**
   * Get device identification
   */
  async getDeviceInfo(): Promise<OpcUaDeviceInfo | null> {
    if (!opcua) {
      return null;
    }

    const client = opcua.OPCUAClient.create({
      endpointMustExist: false,
      connectionStrategy: {
        initialDelay: 100,
        maxRetry: 0,
        maxDelay: 1000,
      },
      requestedSessionTimeout: 5000,
      securityMode: opcua.MessageSecurityMode.None,
      securityPolicy: opcua.SecurityPolicy.None,
      connectionTimeout: 3000,
    });

    const endpointUrl = `opc.tcp://${this.ip}:${this.port}`;

    try {
      // Suppress logging during connection
      suppressOpcUaLogging();

      // Connect to OPC-UA server
      await withTimeout(client.connect(endpointUrl), 3000);

      let session: any = null;
      const deviceInfo: OpcUaDeviceInfo = {
        productName: null,
        manufacturerName: null,
        softwareVersion: null,
        buildNumber: null,
        deviceType: 'OPC UA Device',
        serverIdentity: null,
        startTime: null,
        currentTime: null,
      };

      try {
        // Create session (still suppressed)
        session = await withTimeout(client.createSession(), 3000);

        // Restore logging briefly
        restoreLogging();

        // Read server status (contains buildInfo)
        suppressOpcUaLogging();

        try {
          const serverStatus = await session.read({
            nodeId: 'ns=0;i=2256',
            attributeId: opcua.AttributeIds.Value,
          });

          if (
            serverStatus &&
            serverStatus.value &&
            serverStatus.value.value &&
            serverStatus.value.value.buildInfo
          ) {
            const buildInfo = serverStatus.value.value.buildInfo;
            deviceInfo.productName = buildInfo.productName;
            deviceInfo.manufacturerName = buildInfo.manufacturerName;
            deviceInfo.softwareVersion = buildInfo.softwareVersion;
            deviceInfo.buildNumber = buildInfo.buildNumber;
            deviceInfo.startTime = serverStatus.value.value.startTime;
            deviceInfo.currentTime = serverStatus.value.value.currentTime;
          }
        } catch {
          // Continue without server status
        }

        // Read server array
        try {
          const serverArray = await session.read({
            nodeId: 'ns=0;i=2254',
            attributeId: opcua.AttributeIds.Value,
          });

          if (
            serverArray &&
            serverArray.value &&
            serverArray.value.value &&
            serverArray.value.value.length > 0
          ) {
            deviceInfo.serverIdentity = serverArray.value.value[0];
          }
        } catch {
          // Continue without server array
        }
      } finally {
        // Cleanup (suppress during disconnect)
        suppressOpcUaLogging();

        if (session && session.sessionId) {
          try {
            await session.close();
          } catch {
            // Ignore
          }
        }

        try {
          await client.disconnect();
        } catch {
          // Ignore
        }

        restoreLogging();
      }

      return deviceInfo;
    } catch {
      restoreLogging();

      return null;
    }
  }
}
