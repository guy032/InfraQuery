/**
 * BACnet Protocol Discovery (Native Implementation)
 *
 * Uses the bacstack library for proper BACnet protocol implementation.
 * This demonstrates how to add protocols that Telegraf doesn't support.
 *
 * To enable: Set discovery.enabled = true in telegraf/plugins/bacnet.json
 */

import bacnet from 'bacstack';

import log from '../../lib/infrastructure/logger';
import bacnetConcurrency from './bacnet-concurrency';
import { BACnetDiscoveryHelpers, COMMON_BACNET_INSTANCES } from './bacnet-discovery-helpers';
import { BACnetPropertyReader } from './bacnet-property-reader';
import { BACnetUtils } from './bacnet-utils';
import { BACnetVendorManager } from './bacnet-vendor';
import type { BACnetDevice, BACnetDiscoveryOptions, ClientConfig, DiscoveredDevice } from './types';

export class BACnetDiscovery {
  private vendorManager: BACnetVendorManager;

  constructor() {
    this.vendorManager = new BACnetVendorManager();
  }

  /**
   * Discover BACnet devices on the network with comprehensive property reading
   *
   * @param {string} agent - Target IP or broadcast address
   * @param {number} port - BACnet port (usually 47808)
   * @param {Object} options - Discovery options
   * @returns {Promise<Array>} Discovered devices in Telegraf JSON format
   */
  async discover(agent: string, port: number, options: BACnetDiscoveryOptions = {}) {
    // Configuration optimized for subnet scanning (faster timeouts)
    const config: ClientConfig = { port, apduTimeout: 3000, apduSegmentTimeout: 1000 };

    // Wait for a concurrency slot (limits parallel BACnet scans to avoid UDP conflicts)
    await bacnetConcurrency.acquire();

    try {
      // Add small random delay (0-100ms) to stagger parallel scans and reduce network congestion
      const staggerDelay = Math.random() * 100;
      await new Promise((resolve) => setTimeout(resolve, staggerDelay));

      log.info(
        `🔍 BACnet: Starting discovery on ${agent}:${port} (timeout: ${config.apduTimeout}ms)`,
      );

      const result = await this.tryBacnetConnection(agent, config, options);

      if (result.success && result.devices) {
        log.info(
          `✓ BACnet: Discovery succeeded, found ${result.devices.length} device(s) on ${agent}`,
        );

        return BACnetUtils.formatResults(result.devices, agent);
      }

      log.info(`✗ BACnet: Discovery failed for ${agent}: ${result.error}`);

      return [];
    } finally {
      // Always release the concurrency slot
      bacnetConcurrency.release();
    }
  }

  /**
   * Try BACnet connection with specific configuration
   */
  private async tryBacnetConnection(
    ipAddress: string,
    config: ClientConfig,
    _options: BACnetDiscoveryOptions,
  ) {
    const client = new bacnet(config);
    let isClientClosed = false;

    const closeClient = async () => {
      if (!isClientClosed) {
        isClientClosed = true;

        try {
          client.close();
          // Small delay to ensure UDP socket is fully closed before returning
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (error: any) {
          log.verbose(`BACnet: Error closing client: ${error.message}`);
        }
      }
    };

    try {
      // Step 1: Quick device presence test
      const isBACnetDevice = await BACnetDiscoveryHelpers.testBACnetDevicePresence(
        client,
        ipAddress,
      );

      if (!isBACnetDevice) {
        await closeClient();

        return {
          success: false,
          error: 'No BACnet device detected',
        };
      }

      log.verbose('BACnet: Device confirmed, reading properties...');

      // Step 2: Discover devices using Who-Is/I-Am
      const discoveredDevices = await BACnetDiscoveryHelpers.discoverDevices(client, ipAddress);

      if (discoveredDevices.length === 0) {
        log.verbose('BACnet: No devices via Who-Is, trying common instances...');

        for (const deviceId of COMMON_BACNET_INSTANCES) {
          // eslint-disable-next-line no-await-in-loop
          const testValue = await BACnetPropertyReader.readSingleProperty(
            client,
            ipAddress,
            deviceId,
            8,
            77,
          );

          if (testValue !== null) {
            log.verbose(`BACnet: Found device ${deviceId}`);
            discoveredDevices.push({
              deviceId,
              address: ipAddress,
              objectName: testValue as string,
            });
            break;
          }
        }

        if (discoveredDevices.length === 0) {
          await closeClient();

          return {
            success: false,
            error: 'No accessible device instances found',
          };
        }
      }

      // Step 3: Get device information (only first device for speed)
      const devices: BACnetDevice[] = [];
      const device = discoveredDevices[0]; // Only read first device for performance

      log.verbose(`BACnet: Reading device ${device.deviceId}...`);
      const deviceInfo = await this.getDeviceInfo(client, ipAddress, device, config.port);

      if (deviceInfo) {
        devices.push(deviceInfo);
      }

      await closeClient();

      return {
        success: true,
        devices,
      };
    } catch (error: any) {
      log.verbose(`BACnet: Error: ${error.message}`);
      await closeClient();

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get comprehensive device information
   */
  private async getDeviceInfo(
    client: any,
    ipAddress: string,
    device: DiscoveredDevice,
    port: number,
  ): Promise<BACnetDevice | null> {
    const properties = await BACnetPropertyReader.readDeviceProperties(
      client,
      ipAddress,
      device.deviceId,
    );

    // Handle vendor ID/name confusion - some devices return vendor ID for vendor name property
    const actualVendorId: number | null =
      (properties[79] as number) || (typeof properties[62] === 'number' ? properties[62] : null);
    const actualVendorName: string | null =
      typeof properties[62] === 'string' ? properties[62] : null;

    const supportedObjectTypes = properties[97]
      ? BACnetUtils.decodeProtocolObjectTypes(properties[97])
      : undefined;

    const deviceInfo: BACnetDevice = {
      ip: device.address || ipAddress,
      port,
      deviceInstance: device.deviceId,
      objectName: properties[77] || device.objectName || 'Unknown Device',
      applicationSoftwareVersion: properties[12],
      firmware: properties[44],
      firmwareRevision: properties[44],
      vendorName: actualVendorName,
      model: properties[70],
      vendorId: actualVendorId,
      vendorNameLookup: this.vendorManager.getVendorNameFromId(actualVendorId),
      supportedObjectTypes,
      maxApdu: device.maxApdu,
      segmentation: device.segmentation,
    };

    log.verbose(
      `BACnet: Device info: ${deviceInfo.objectName} (${deviceInfo.vendorNameLookup || 'Unknown vendor'})`,
    );

    return deviceInfo;
  }
}

/**
 * Main discovery function for the scanner
 * This is the interface the scanner expects for native protocols
 */
export async function discover(agent: string, port: number, options: BACnetDiscoveryOptions) {
  const discovery = new BACnetDiscovery();

  return discovery.discover(agent, port, options);
}
