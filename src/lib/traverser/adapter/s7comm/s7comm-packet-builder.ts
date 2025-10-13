/**
 * S7 Packet Builder Module
 * Handles construction of S7 protocol packets (COTP, S7 setup, SZL requests)
 */

/* eslint-disable no-bitwise */
import { S7_PROTOCOL } from './s7comm-constants';

/**
 * Build COTP Connection Request packet
 */
export function buildCOTPConnectionRequest(rack: number, slot: number): Buffer {
  const tpktLength = 22;
  const tpkt = Buffer.from([
    S7_PROTOCOL.TPKT_VERSION,
    0x00,
    (tpktLength >> 8) & 0xff,
    tpktLength & 0xff,
  ]);

  const tsap = rack * 0x20 + slot;
  const cotp = Buffer.from([
    0x11, // Length
    0xe0, // CR (Connection Request)
    0x00,
    0x00, // Destination reference
    0x00,
    0x01, // Source reference
    0x00, // Class/options
    0xc0,
    0x01,
    0x0a, // TPDU size (1024)
    0xc1,
    0x02,
    0x01,
    0x00, // src-tsap
    0xc2,
    0x02,
    0x01,
    0x02, // dst-tsap
  ]);

  cotp[11] = tsap;

  return Buffer.concat([tpkt, cotp]);
}

/**
 * Build S7 Communication Setup packet
 */
export function buildS7SetupCommunication(): Buffer {
  const tpkt = Buffer.from([0x03, 0x00, 0x00, 0x19]); // Length = 25
  const cotp = Buffer.from([0x02, 0xf0, 0x80]); // COTP Data

  const s7Header = Buffer.from([
    0x32, // Protocol ID
    0x01, // Job request
    0x00,
    0x00, // Redundancy ID
    0x00,
    0x00, // PDU reference
    0x00,
    0x08, // Parameter length
    0x00,
    0x00, // Data length
  ]);

  const s7Params = Buffer.from([
    0xf0, // Function: Setup communication
    0x00, // Reserved
    0x00,
    0x01, // Max AMQ calling
    0x00,
    0x01, // Max AMQ called
    0x03,
    0xc0, // PDU length (960)
  ]);

  return Buffer.concat([tpkt, cotp, s7Header, s7Params]);
}

/**
 * Build SZL Read Request packet
 */
export function buildSZLReadRequest(szlId: number, szlIndex: number, pduRef: number): Buffer {
  const tpkt = Buffer.from([0x03, 0x00, 0x00, 0x21]); // Length = 33
  const cotp = Buffer.from([0x02, 0xf0, 0x80]);

  const s7Header = Buffer.from([
    0x32, // Protocol ID
    0x07, // Job request (user data)
    0x00,
    0x00, // Redundancy ID
    (pduRef >> 8) & 0xff,
    pduRef & 0xff, // PDU reference
    0x00,
    0x0c, // Parameter length (12)
    0x00,
    0x04, // Data length (4)
  ]);

  const s7Params = Buffer.from([
    0x00,
    0x01, // Function group
    0x12, // Subfunction
    0x04, // Sequence
    0x11, // Data unit reference
    0x44, // Last data unit
    0x01, // Error code
    0x00,
    0x00, // Reserved
    (szlId >> 8) & 0xff,
    szlId & 0xff, // SZL ID
    (szlIndex >> 8) & 0xff,
    szlIndex & 0xff, // SZL Index
  ]);

  const s7Data = Buffer.from([
    0xff,
    0x09, // Return code and transport size
    0x00,
    0x04, // Length
  ]);

  return Buffer.concat([tpkt, cotp, s7Header, s7Params, s7Data]);
}
