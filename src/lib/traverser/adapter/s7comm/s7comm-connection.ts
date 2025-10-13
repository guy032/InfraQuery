/**
 * S7 Connection Management Module
 * Handles connection lifecycle and data reading operations
 */

import net from 'net';

// eslint-disable-next-line @typescript-eslint/no-var-requires
import log from '../../lib/infrastructure/logger';
import {
  buildCOTPConnectionRequest,
  buildS7SetupCommunication,
  buildSZLReadRequest,
} from './s7comm-packet-builder';
import { parseSZLResponse, validateCOTPResponse, validateS7SetupResponse } from './s7comm-parser';
import type { S7ScannerState, SZLRequest, SZLResults } from './types';

/**
 * Connect to PLC and negotiate communication
 */
export async function connect(scanner: S7ScannerState): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    scanner.socket = new net.Socket();
    scanner.socket.setTimeout(scanner.timeout);

    let step = 'connecting';
    let responseBuffer = Buffer.alloc(0);

    const cleanup = () => {
      if (scanner.socket) {
        scanner.socket.removeAllListeners();
      }
    };

    scanner.socket.on('connect', () => {
      step = 'cotp';
      log.verbose(`TCP connected to ${scanner.host}:${scanner.port}, sending COTP request`);

      try {
        const cotpPacket = buildCOTPConnectionRequest(scanner.rack, scanner.slot);

        if (scanner.socket) {
          scanner.socket.write(cotpPacket);
        }
      } catch (error) {
        cleanup();
        reject(error);
      }
    });

    scanner.socket.on('data', (data) => {
      responseBuffer = Buffer.concat([responseBuffer, data]);

      try {
        if (step === 'cotp') {
          // Wait for COTP response (minimum 22 bytes)
          if (responseBuffer.length >= 22) {
            const cotpResponse = responseBuffer.slice(0, 22);
            responseBuffer = responseBuffer.slice(22);

            if (validateCOTPResponse(cotpResponse)) {
              scanner.connected = true;
              step = 's7comm';
              log.verbose('COTP connection established, sending S7 setup');
              const setupPacket = buildS7SetupCommunication();

              if (scanner.socket) {
                scanner.socket.write(setupPacket);
              }
            } else {
              cleanup();
              reject(new Error('Invalid COTP response'));
            }
          }
        } else if (
          step === 's7comm' && // Wait for S7 setup response (minimum 25 bytes)
          responseBuffer.length >= 25
        ) {
          responseBuffer = Buffer.alloc(0); // Clear buffer

          if (validateS7SetupResponse(data)) {
            scanner.negotiatedPDU = true;
            log.verbose('S7 communication setup complete');
            cleanup();
            resolve();
          } else {
            cleanup();
            reject(new Error('Invalid S7 setup response'));
          }
        }
      } catch (error) {
        cleanup();
        reject(error);
      }
    });

    scanner.socket.on('error', (err) => {
      cleanup();
      reject(new Error(`Connection error: ${err.message}`));
    });

    scanner.socket.on('timeout', () => {
      cleanup();
      reject(new Error('Connection timeout'));
    });

    scanner.socket.on('close', () => {
      if (!scanner.negotiatedPDU) {
        cleanup();
        reject(new Error('Connection closed before setup complete'));
      }
    });

    scanner.socket.connect(scanner.port, scanner.host);
  });
}

/**
 * Read SZL data from PLC
 */
export async function readSZL(
  scanner: S7ScannerState,
  szlId: number,
  szlIndex = 0x00_00,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    if (!scanner.connected || !scanner.socket) {
      return reject(new Error('Not connected to PLC'));
    }

    const timeoutId = setTimeout(() => {
      reject(new Error('SZL read timeout'));
    }, scanner.timeout);

    let responseBuffer = Buffer.alloc(0);

    const onData = (data: Buffer): void => {
      responseBuffer = Buffer.concat([responseBuffer, data]);

      // Check if we have enough data for TPKT header
      if (responseBuffer.length >= 4) {
        const tpktLength = responseBuffer.readUInt16BE(2);

        // Check if we have the complete packet
        if (responseBuffer.length >= tpktLength) {
          clearTimeout(timeoutId);

          if (scanner.socket) {
            scanner.socket.removeListener('data', onData);
          }

          try {
            const szlData = parseSZLResponse(responseBuffer);
            resolve(szlData);
          } catch (error) {
            reject(error);
          }
        }
      }
    };

    const onError = (err: Error): void => {
      clearTimeout(timeoutId);
      scanner.socket?.removeListener('data', onData);
      reject(err);
    };

    scanner.socket?.on('data', onData);
    scanner.socket?.once('error', onError);

    try {
      const szlRequest = buildSZLReadRequest(szlId, szlIndex, scanner.pduRef++);
      scanner.socket?.write(szlRequest);
      log.verbose(`Sent SZL read request for ID 0x${szlId.toString(16).padStart(4, '0')}`);
    } catch (error) {
      clearTimeout(timeoutId);
      scanner.socket?.removeListener('data', onData);
      reject(error);
    }
  });
}

/**
 * Read multiple SZL IDs in a pipelined fashion (Shodan-style)
 * Send all requests immediately, then collect responses
 */
export async function readMultipleSZL(
  scanner: S7ScannerState,
  szlRequests: SZLRequest[],
): Promise<SZLResults> {
  return new Promise<SZLResults>((resolve, reject) => {
    if (!scanner.connected || !scanner.socket) {
      return reject(new Error('Not connected to PLC'));
    }

    const timeoutId = setTimeout(() => {
      reject(new Error('Multiple SZL read timeout'));
    }, scanner.timeout * 2); // Double timeout for multiple reads

    let responseBuffer = Buffer.alloc(0);
    const results: Record<string, Buffer> = {};
    let responsesReceived = 0;

    const onData = (data: Buffer): void => {
      responseBuffer = Buffer.concat([responseBuffer, data]);

      // Try to parse all complete packets in the buffer
      while (responseBuffer.length >= 4) {
        const tpktLength = responseBuffer.readUInt16BE(2);

        if (responseBuffer.length >= tpktLength) {
          const packet = responseBuffer.slice(0, tpktLength);
          responseBuffer = responseBuffer.slice(tpktLength);

          try {
            const szlData = parseSZLResponse(packet);
            // Store by response count (we'll match them up by order)
            results[`response_${responsesReceived}`] = szlData;
            responsesReceived++;

            // If we got all responses, we're done
            if (responsesReceived >= szlRequests.length) {
              clearTimeout(timeoutId);
              scanner.socket?.removeListener('data', onData);

              // Map responses back to request names
              const mappedResults: SZLResults = {};

              for (const [i, req] of szlRequests.entries()) {
                if (results[`response_${i}`]) {
                  mappedResults[req.name] = results[`response_${i}`];
                }
              }

              resolve(mappedResults);

              return;
            }
          } catch (error) {
            log.verbose(`Error parsing SZL response: ${error.message}`);
            responsesReceived++; // Count it even if parse failed
          }
        } else {
          break; // Wait for more data
        }
      }
    };

    const onError = (err: Error): void => {
      clearTimeout(timeoutId);
      scanner.socket?.removeListener('data', onData);

      // Return partial results if we got any
      if (responsesReceived > 0) {
        const mappedResults: SZLResults = {};

        for (const [i, req] of szlRequests.entries()) {
          if (results[`response_${i}`]) {
            mappedResults[req.name] = results[`response_${i}`];
          }
        }

        resolve(mappedResults);
      } else {
        reject(err);
      }
    };

    scanner.socket?.on('data', onData);
    scanner.socket?.once('error', onError);
    scanner.socket?.once('close', () => {
      clearTimeout(timeoutId);
      // Return whatever we managed to get
      const mappedResults: SZLResults = {};

      for (const [i, req] of szlRequests.entries()) {
        if (results[`response_${i}`]) {
          mappedResults[req.name] = results[`response_${i}`];
        }
      }

      if (Object.keys(mappedResults).length > 0) {
        resolve(mappedResults);
      } else {
        onError(new Error('Connection closed before receiving data'));
      }
    });

    try {
      // PIPELINE: Send all SZL requests immediately without waiting
      log.verbose(`Pipelining ${szlRequests.length} SZL read requests...`);

      for (const [i, req] of szlRequests.entries()) {
        const szlIndex = req.index ?? 0x00_00;
        const szlRequest = buildSZLReadRequest(req.id, szlIndex, scanner.pduRef++);
        scanner.socket?.write(szlRequest);
        log.verbose(
          `  Sent SZL read #${i + 1} for ID 0x${req.id.toString(16).padStart(4, '0')}, index 0x${szlIndex.toString(16).padStart(4, '0')}`,
        );
      }
    } catch (error) {
      clearTimeout(timeoutId);
      scanner.socket?.removeListener('data', onData);
      reject(error);
    }
  });
}

/**
 * Disconnect from PLC
 */
export function disconnect(scanner: S7ScannerState): void {
  if (scanner.socket) {
    scanner.socket.destroy();
    scanner.socket = null;
    scanner.connected = false;
    scanner.negotiatedPDU = false;
  }
}
