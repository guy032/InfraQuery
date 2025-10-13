/**
 * TypeScript type definitions for S7comm protocol
 */

import type { Socket } from 'net';

/**
 * S7 Protocol Constants
 */
export interface S7Protocol {
  TPKT_VERSION: number;
  ISO_HEADER_LENGTH: number;
  S7_HEADER_LENGTH: number;
  DEFAULT_PORT: number;
  CONNECTION_TYPES: {
    PG: number;
    OP: number;
    BASIC: number;
  };
  FUNC_READ: number;
  FUNC_WRITE: number;
  FUNC_SETUP_COMM: number;
  AREA_SZL: number;
  SZL_ID: {
    MODULE_IDENTIFICATION: number;
    COMPONENT_IDENTIFICATION: number;
    ORDER_CODE: number;
    FIRMWARE_VERSION: number;
    MODULE_STATUS: number;
    SYSTEM_DATA: number;
    COMMUNICATIONS_CAPABILITIES: number;
    DIAGNOSTIC_BUFFER: number;
  };
  SZL_INDEX_001C: {
    ALL: number;
    INDEX_1: number;
    INDEX_6: number;
    INDEX_7: number;
  };
}

/**
 * Module identification information
 */
export interface ModuleInfo {
  cpuModel?: string;
  orderNumber?: string;
}

/**
 * Component identification information
 */
export interface ComponentInfo {
  orderNumber?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  moduleName?: string;
  plantIdentification?: string;
  copyright?: string;
  moduleTypeName?: string;
  hardwareVersion?: string;
  bootloaderVersion?: string;
}

/**
 * Module status information
 */
export type ModuleStatusInfo = Record<string, any>;

/**
 * S7 Device information
 */
export interface S7DeviceInfo {
  vendor: string;
  port: number;
  rack: number;
  slot: number;
  available: boolean;
  protocol?: string;
  cpuModel?: string;
  orderNumber?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  moduleName?: string;
  plantIdentification?: string;
  copyright?: string;
  moduleTypeName?: string;
  hardwareVersion?: string;
  bootloaderVersion?: string;
}

/**
 * S7 Scanner options
 */
export interface S7ScannerOptions {
  rack?: number;
  slot?: number;
  timeout?: number;
  connectionType?: string;
}

/**
 * SZL read request
 */
export interface SZLRequest {
  id: number;
  name: string;
  index?: number;
}

/**
 * SZL response results
 */
export type SZLResults = Record<string, Buffer>;

/**
 * Rack/Slot combination
 */
export interface RackSlotCombo {
  rack: number;
  slot: number;
}

/**
 * Telegraf metric format
 */
export interface TelegrafMetric {
  name: string;
  fields: Record<string, number | string>;
  tags: Record<string, string>;
  timestamp: number;
}

/**
 * S7comm post-processor options
 */
export interface S7Options {
  rack?: number;
  slot?: number;
  connectionType?: string;
  timeout?: string | number;
  [key: string]: unknown;
}

/**
 * S7CommScanner internal state
 */
export interface S7ScannerState {
  host: string;
  port: number;
  rack: number;
  slot: number;
  timeout: number;
  connectionType: string;
  socket: Socket | null;
  pduRef: number;
  connected: boolean;
  negotiatedPDU: boolean;
}
