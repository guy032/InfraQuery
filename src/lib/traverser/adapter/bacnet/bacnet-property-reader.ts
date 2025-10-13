/**
 * BACnet Property Reading Functions
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
import log from '../../lib/infrastructure/logger';

export class BACnetPropertyReader {
  /**
   * Read essential device properties
   */
  static async readDeviceProperties(
    client: any,
    ipAddress: string,
    deviceId: number,
  ): Promise<Record<number, any>> {
    const DEVICE_TYPE = 8;
    const essentialProperties = [
      77, // Object-Name (most reliable, read first)
      79, // Vendor-ID (high priority)
      70, // Model-Name (high priority)
      12, // Application-Software-Version
      44, // Firmware-Revision
      62, // Vendor-Name
    ];

    // Try ReadPropertyMultiple first
    log.verbose('BACnet: Reading properties...');
    const result = await this.readMultipleProperties(
      client,
      ipAddress,
      deviceId,
      DEVICE_TYPE,
      deviceId,
      essentialProperties,
    );

    if (result && Object.keys(result).length > 0) {
      log.verbose(`BACnet: Got ${Object.keys(result).length} properties`);

      return result;
    }

    // Fallback to sequential individual property reads
    log.verbose('BACnet: Fallback to individual reads...');
    const properties: Record<number, any> = {};

    // Read only essential properties (no delay between reads)
    for (const prop of essentialProperties) {
      // eslint-disable-next-line no-await-in-loop
      const value = await this.readSingleProperty(client, ipAddress, deviceId, DEVICE_TYPE, prop);

      if (value !== null) {
        properties[prop] = value;
      }
    }

    log.verbose(`BACnet: Got ${Object.keys(properties).length} properties`);

    return properties;
  }

  /**
   * Read multiple properties at once
   */
  private static readMultipleProperties(
    client: any,
    ipAddress: string,
    deviceId: number,
    objectType: number,
    instance: number,
    properties: number[],
  ): Promise<Record<number, any> | null> {
    return new Promise((resolve) => {
      const propertyList = properties.map((prop) => ({ id: prop }));
      let hasResolved = false;

      // Reduced timeout from 3s to 2s
      const timeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          log.verbose('BACnet: ReadPropertyMultiple timeout');
          resolve(null);
        }
      }, 2000);

      try {
        client.readPropertyMultiple(
          ipAddress,
          [
            {
              objectId: { type: objectType, instance },
              properties: propertyList,
            },
          ],
          (err: Error, value: any) => {
            if (hasResolved) {
              return;
            }

            hasResolved = true;
            clearTimeout(timeout);

            if (err) {
              log.verbose(`BACnet: ReadPropertyMultiple error: ${err.message}`);
              resolve(null);
            } else {
              const result: Record<number, any> = {};

              if (value && value[0] && value[0].values) {
                for (let index = 0; index < value[0].values.length; index++) {
                  const prop = value[0].values[index];

                  if (prop.values && prop.values[0]) {
                    const rawValue = prop.values[0].value;

                    result[properties[index]] = Buffer.isBuffer(rawValue)
                      ? rawValue.toString().replaceAll('\0', '')
                      : rawValue;
                  }
                }
              }

              // Return null if no properties were successfully read
              if (Object.keys(result).length === 0) {
                resolve(null);
              } else {
                resolve(result);
              }
            }
          },
        );
      } catch (error: any) {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeout);
          log.verbose(`BACnet: ReadPropertyMultiple exception: ${error.message}`);
          resolve(null);
        }
      }
    });
  }

  /**
   * Read single property (no retries for speed)
   */
  static readSingleProperty(
    client: any,
    ipAddress: string,
    deviceId: number,
    objectType: number,
    propertyId: number,
  ): Promise<any> {
    return new Promise((resolve) => {
      let hasResponded = false;

      // Reduced from 10s to 2s
      const timeout = setTimeout(() => {
        if (!hasResponded) {
          hasResponded = true;
          log.verbose(`BACnet: Property ${propertyId} timeout`);
          resolve(null);
        }
      }, 2000);

      client.readProperty(
        ipAddress,
        { type: objectType, instance: deviceId },
        propertyId,
        (err: Error, value: any) => {
          if (hasResponded) {
            return;
          }

          hasResponded = true;
          clearTimeout(timeout);

          if (err) {
            log.verbose(`BACnet: Property ${propertyId} error: ${err.message}`);
            resolve(null);
          } else {
            if (value && value.values && value.values[0]) {
              const rawValue = value.values[0].value;
              const result = Buffer.isBuffer(rawValue)
                ? rawValue.toString().replaceAll('\0', '')
                : rawValue;

              log.verbose(`BACnet: Property ${propertyId} success`);
              resolve(result);
            } else {
              log.verbose(`BACnet: Property ${propertyId} no value`);
              resolve(null);
            }
          }
        },
      );
    });
  }

  /**
   * Get human-readable property name
   */
  private static getPropertyName(propertyId: number): string {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const propertyNames: Record<number, string> = {
      12: 'Application-Software-Version',
      44: 'Firmware-Revision',
      62: 'Vendor-Name',
      70: 'Model-Name',
      76: 'Object-List',
      77: 'Object-Name',
      79: 'Vendor-ID',
      97: 'Protocol-Object-Types-Supported',
    };

    return propertyNames[propertyId] || `Property-${propertyId}`;
  }
}
