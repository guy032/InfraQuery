/**
 * Siemens S7 Protocol Implementation
 *
 * Handles S7 protocol communication for device discovery and identification.
 * Implements SZL (System Status List) reads for CPU identification.
 * The actual data collection is performed by the Telegraf S7comm input plugin.
 */

import type { Socket } from 'net';

// eslint-disable-next-line @typescript-eslint/no-var-requires
import log from '../../lib/infrastructure/logger';
import { connect, disconnect, readMultipleSZL, readSZL } from './s7comm-connection';
import { S7_PROTOCOL } from './s7comm-constants';
import {
  parseComponentIdentification,
  parseModuleIdentification,
  parseModuleStatus,
} from './s7comm-parser';
import type { S7DeviceInfo, S7ScannerOptions, SZLRequest } from './types';

/**
 * S7comm Device Scanner
 * Performs device identification using SZL reads
 */
export class S7CommScanner {
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

  constructor(host: string, port = S7_PROTOCOL.DEFAULT_PORT, options: S7ScannerOptions = {}) {
    this.host = host;
    this.port = port;
    this.rack = options.rack === undefined ? 0 : options.rack;
    this.slot = options.slot === undefined ? 0 : options.slot;
    this.timeout = options.timeout || 8000;
    this.connectionType = options.connectionType || 'PD';
    this.socket = null;
    this.pduRef = 1; // PDU reference counter
    this.connected = false;
    this.negotiatedPDU = false;
  }

  /**
   * Connect to PLC and negotiate communication
   */
  connect(): Promise<void> {
    return connect(this);
  }

  /**
   * Read SZL data from PLC
   */
  readSZL(szlId: number, szlIndex = 0x00_00): Promise<Buffer> {
    return readSZL(this, szlId, szlIndex);
  }

  /**
   * Get comprehensive device information (Shodan-style aggressive collection)
   */
  async getDeviceInfo(): Promise<S7DeviceInfo> {
    const deviceInfo: S7DeviceInfo = {
      vendor: 'Siemens',
      port: this.port,
      rack: this.rack,
      slot: this.slot,
      available: true,
    };

    try {
      // STRATEGY 1: Try multiple SZL indices for component identification
      // Different PLC models respond to different indices
      await this.connect();

      // Try index 0x0001 - often contains order number and basic info
      try {
        log.verbose('Trying component identification with index 0x0001');
        const componentData1 = await this.readSZL(
          S7_PROTOCOL.SZL_ID.COMPONENT_IDENTIFICATION,
          S7_PROTOCOL.SZL_INDEX_001C.INDEX_1,
        );

        if (componentData1) {
          const componentInfo = parseComponentIdentification(componentData1);
          Object.assign(deviceInfo, componentInfo);
          log.verbose(`Successfully read component identification (index 1)`);
        }
      } catch (error) {
        log.verbose(`Component identification (index 1) read failed: ${error.message}`);
      }

      // Try index 0x0006 if we still don't have enough info
      if (!deviceInfo.orderNumber || !deviceInfo.cpuModel) {
        try {
          log.verbose('Trying component identification with index 0x0006');
          const componentData6 = await this.readSZL(
            S7_PROTOCOL.SZL_ID.COMPONENT_IDENTIFICATION,
            S7_PROTOCOL.SZL_INDEX_001C.INDEX_6,
          );

          if (componentData6) {
            const componentInfo = parseComponentIdentification(componentData6);
            Object.assign(deviceInfo, componentInfo);
            log.verbose(`Successfully read component identification (index 6)`);
          }
        } catch (error) {
          log.verbose(`Component identification (index 6) read failed: ${error.message}`);
        }
      }

      // Try default index 0x0000
      if (!deviceInfo.orderNumber || !deviceInfo.cpuModel) {
        try {
          log.verbose('Trying component identification with index 0x0000');
          const componentData = await this.readSZL(S7_PROTOCOL.SZL_ID.COMPONENT_IDENTIFICATION);

          if (componentData) {
            const componentInfo = parseComponentIdentification(componentData);
            Object.assign(deviceInfo, componentInfo);
            log.verbose(`Successfully read component identification (index 0)`);
          }
        } catch (error) {
          log.verbose(`Component identification (index 0) read failed: ${error.message}`);
        }
      }

      this.disconnect();

      // STRATEGY 2: Try SZL 0x0131 for order code (some PLCs respond better to this)
      if (!deviceInfo.orderNumber) {
        try {
          await this.connect();
          log.verbose('Trying order code with SZL 0x0131');
          const orderData = await this.readSZL(S7_PROTOCOL.SZL_ID.ORDER_CODE);

          if (orderData) {
            const orderInfo = parseModuleIdentification(orderData);
            Object.assign(deviceInfo, orderInfo);
            log.verbose(`Successfully read order code`);
          }
        } catch (error) {
          log.verbose(`Order code read failed: ${error.message}`);
        } finally {
          this.disconnect();
        }
      }

      // STRATEGY 3: Read module identification for CPU model
      // Reconnect and read separately since PLCs often close connection after first query
      if (!deviceInfo.cpuModel) {
        try {
          await this.connect();

          const moduleData = await this.readSZL(S7_PROTOCOL.SZL_ID.MODULE_IDENTIFICATION);

          if (moduleData) {
            const moduleInfo = parseModuleIdentification(moduleData);
            Object.assign(deviceInfo, moduleInfo);
            log.verbose(`Successfully read module identification`);
          }
        } catch (error) {
          log.verbose(`Module identification read failed: ${error.message}`);
        } finally {
          this.disconnect();
        }
      }

      return deviceInfo;
    } catch (error) {
      this.disconnect();

      throw error;
    }
  }

  /**
   * Read multiple SZL IDs in a pipelined fashion (Shodan-style)
   * Send all requests immediately, then collect responses
   */
  readMultipleSZL(szlRequests: SZLRequest[]): Promise<Record<string, Buffer>> {
    return readMultipleSZL(this, szlRequests);
  }

  /**
   * Disconnect from PLC
   */
  disconnect(): void {
    disconnect(this);
  }
}
