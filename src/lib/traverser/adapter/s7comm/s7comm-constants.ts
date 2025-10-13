/**
 * S7 Protocol Constants and Definitions
 * Contains all protocol-level constants used in S7 communication
 */

import type { S7Protocol } from './types';

/**
 * S7 Protocol Constants
 */
export const S7_PROTOCOL: S7Protocol = {
  TPKT_VERSION: 0x03,
  ISO_HEADER_LENGTH: 7,
  S7_HEADER_LENGTH: 10,
  DEFAULT_PORT: 102,
  CONNECTION_TYPES: {
    PG: 0x01, // Programming Device
    OP: 0x02, // Operator Panel
    BASIC: 0x03, // S7 Basic Communication
  },
  // S7 Function Codes
  FUNC_READ: 0x04,
  FUNC_WRITE: 0x05,
  FUNC_SETUP_COMM: 0xf0,
  // S7 Area codes
  AREA_SZL: 0x00,
  // SZL IDs for device identification
  SZL_ID: {
    MODULE_IDENTIFICATION: 0x00_11, // CPU Model
    COMPONENT_IDENTIFICATION: 0x00_1c, // Order number, serial, version, module info
    ORDER_CODE: 0x01_31, // Direct order code / article number
    FIRMWARE_VERSION: 0x0f_12, // Firmware version details
    MODULE_STATUS: 0x01_11, // Module status
    SYSTEM_DATA: 0x00_74, // System data
    COMMUNICATIONS_CAPABILITIES: 0x00_19, // Communication capabilities
    DIAGNOSTIC_BUFFER: 0x00_a0, // Diagnostic buffer
  },
  // SZL 0x001C indices for different component information
  SZL_INDEX_001C: {
    ALL: 0x00_00, // All components (default)
    INDEX_1: 0x00_01, // Additional module info
    INDEX_6: 0x00_06, // More detailed component info
    INDEX_7: 0x00_07, // Extended info
  },
};
