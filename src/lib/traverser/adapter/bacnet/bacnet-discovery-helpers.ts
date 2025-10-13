/**
 * BACnet Device Discovery Helper Functions
 */

import log from '../../lib/infrastructure/logger';
import type { DiscoveredDevice } from './types';

/**
 * Common BACnet device instances to try when discovery fails
 * Ordered by likelihood of success based on industry patterns
 *
 * Note: BACnet device instances range from 0 to 4,194,303 with no standardized
 * defaults. This list covers common patterns, but proper discovery should rely
 * on Who-Is/I-Am broadcasts. These are fallback values for when broadcasts fail.
 *
 * List is kept short to avoid excessive timeout delays (each instance = 500ms timeout)
 */
export const COMMON_BACNET_INSTANCES = [
  4_194_303, // 0x3FFFFF - broadcast/wildcard instance (MUST be first - most common)
  1, // Very common default starting instance
  0, // Some devices use 0
  10, // Common in simple systems
  100, // Common in building automation
  1000, // Common for main controllers
  2588, // Delta Controls devices (like the Fiji device)
  101, // Common
  1001, // Common
  2, // Sequential
  10_101, // Building 1, Floor 1, Device 1
  999, // Some systems
];

export class BACnetDiscoveryHelpers {
  /**
   * Test if device responds to BACnet Who-Is (device presence detection)
   */
  static testBACnetDevicePresence(client: any, ipAddress: string): Promise<boolean> {
    return new Promise((resolve) => {
      log.verbose(`BACnet: Testing device presence for ${ipAddress}...`);
      let isResponseReceived = false;
      // eslint-disable-next-line prefer-const
      let timeoutId: NodeJS.Timeout | undefined;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        try {
          client.removeAllListeners('iAm');
          client.removeAllListeners('error');
        } catch {
          // Ignore cleanup errors
        }
      };

      const iAmHandler = (device: any) => {
        if (!isResponseReceived) {
          isResponseReceived = true;
          log.verbose(`BACnet: Device detected: Instance ${device.deviceId}`);
          cleanup();
          resolve(true);
        }
      };

      client.on('iAm', iAmHandler);
      client.on('error', () => {
        /* Ignore errors */
      });

      try {
        client.whoIs();

        // Quick targeted Who-Is after 800ms
        setTimeout(() => {
          if (!isResponseReceived) {
            for (const deviceId of COMMON_BACNET_INSTANCES) {
              try {
                client.whoIs(deviceId, deviceId);
              } catch {
                // Ignore individual errors
              }
            }
          }
        }, 800);
      } catch (error: any) {
        log.verbose(`BACnet: Failed to send Who-Is: ${error.message}`);
        cleanup();
        resolve(false);

        return;
      }

      // Timeout for device presence (1.5s optimized for subnet scanning)
      timeoutId = setTimeout(() => {
        if (!isResponseReceived) {
          log.verbose(`BACnet: No I-Am response from ${ipAddress}, trying property test...`);
          cleanup();
          void this.testMinimalBACnetProperty(client, ipAddress).then((isBACnet) => {
            if (isBACnet) {
              log.verbose(`BACnet: Device ${ipAddress} confirmed via property test`);
            } else {
              log.verbose(`BACnet: No BACnet response from ${ipAddress}`);
            }

            resolve(isBACnet);
          });
        }
      }, 1500);
    });
  }

  /**
   * Minimal BACnet property test as fallback
   * Tries a wider range of common device instances
   */
  static async testMinimalBACnetProperty(client: any, ipAddress: string): Promise<boolean> {
    log.verbose('BACnet: Testing minimal property...');

    // Try each instance with a quick timeout
    for (const deviceInstance of COMMON_BACNET_INSTANCES) {
      // eslint-disable-next-line no-await-in-loop
      const result = await this.tryReadProperty(client, ipAddress, deviceInstance);

      if (result) {
        log.verbose(`BACnet: Device detected at instance ${deviceInstance}`);

        return true;
      }
    }

    log.verbose('BACnet: Not a BACnet device');

    return false;
  }

  /**
   * Try to read a property from a specific device instance
   */
  private static tryReadProperty(
    client: any,
    ipAddress: string,
    deviceInstance: number,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      let hasResponded = false;

      const timeout = setTimeout(() => {
        if (!hasResponded) {
          hasResponded = true;
          resolve(false);
        }
      }, 500); // Reduced timeout per instance for faster iteration

      client.readProperty(
        ipAddress,
        { type: 8, instance: deviceInstance },
        77, // Object-Name property
        (err: Error, _value: any) => {
          if (!hasResponded) {
            hasResponded = true;
            clearTimeout(timeout);
            resolve(!err);
          }
        },
      );
    });
  }

  /**
   * Discover devices using Who-Is/I-Am
   */
  static discoverDevices(client: any, _ipAddress: string): Promise<DiscoveredDevice[]> {
    return new Promise((resolve) => {
      const discoveredDevices: DiscoveredDevice[] = [];

      // Timeout for discovery (2s optimized for subnet scanning)
      setTimeout(() => {
        log.verbose(`BACnet: Found ${discoveredDevices.length} device(s)`);
        resolve(discoveredDevices);
      }, 2000);

      client.on('iAm', (device: any) => {
        log.verbose(`BACnet: Discovered device ${device.deviceId}`);
        discoveredDevices.push({
          deviceId: device.deviceId,
          address: device.address,
          maxApdu: device.maxApdu,
          segmentation: device.segmentation,
          vendorId: device.vendorId,
        });
      });

      client.on('error', () => {
        /* Ignore errors */
      });

      client.whoIs();

      // Try common instances
      for (const deviceId of COMMON_BACNET_INSTANCES) {
        try {
          client.whoIs(deviceId, deviceId);
        } catch {
          // Ignore errors
        }
      }
    });
  }
}
