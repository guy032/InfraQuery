/**
 * CIP/EtherNet-IP Client Implementation
 * Supports both TCP and UDP connections
 */

import dgram from 'dgram';
import net from 'net';
import { Controller, EthernetIP } from 'st-ethernet-ip';

import log from '../../lib/infrastructure/logger';
import type { CipDeviceInfo, CipScanOptions } from './types';
import { getDeviceType, getVendorName } from './vendors';

/**
 * Test TCP port connectivity
 */
function testTcpPort(host: string, port: number, timeout = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const onError = () => {
      socket.destroy();
      resolve(false);
    };

    socket.setTimeout(timeout);
    socket.once('error', onError);
    socket.once('timeout', onError);

    socket.connect(port, host, () => {
      socket.destroy();
      resolve(true);
    });
  });
}

/**
 * Test UDP port connectivity with List Identity command
 */
function testUdpPort(host: string, port: number, timeout = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');

    const timeoutId = setTimeout(() => {
      socket.close();
      resolve(false);
    }, timeout);

    // Create a basic EtherNet/IP List Identity request message
    const listIdentityRequest = Buffer.from([
      0x63,
      0x00, // Command: List Identity (0x0063)
      0x00,
      0x00, // Length: 0
      0x00,
      0x00,
      0x00,
      0x00, // Session Handle: 0
      0x00,
      0x00,
      0x00,
      0x00, // Status: Success
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // Sender Context: 0
      0x00,
      0x00,
      0x00,
      0x00, // Options: 0
    ]);

    socket.on('message', () => {
      clearTimeout(timeoutId);
      socket.close();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timeoutId);
      socket.close();
      resolve(false);
    });

    socket.send(listIdentityRequest, port, host, (err) => {
      if (err) {
        clearTimeout(timeoutId);
        socket.close();
        resolve(false);
      }
    });
  });
}

/**
 * CIP/EtherNet-IP Client Class
 */
export class CipClient {
  private ip: string;

  private port: number;

  private timeout: number;

  constructor(ip: string, port = 44_818, timeout = 10_000) {
    this.ip = ip;
    this.port = port;
    this.timeout = timeout;
  }

  /**
   * Get device information via TCP
   */
  async getDeviceInfoTcp(slot = 0): Promise<CipDeviceInfo | null> {
    return new Promise((resolve) => {
      const PLC = new Controller();

      const timeoutId = setTimeout(() => {
        log.verbose(`CIP TCP connection timed out after ${this.timeout}ms`);
        PLC.destroy();
        resolve(null);
      }, this.timeout);

      PLC.connect(this.ip, slot)
        .then(async () => {
          log.verbose(`Successfully connected via TCP to ${this.ip}:${this.port}`);

          // Get controller information
          const controller = PLC.state?.controller as any || {};
          const properties = PLC.properties as any || {};

          // Clean up product name (remove null characters)
          const productName = (properties.name || controller.name || 'Unknown')
            .replaceAll('\0', '')
            .trim();

          // Format serial number as hex
          const serialNumber = properties.serial_number || controller.serial_number;
          const serialHex = serialNumber
            ? `0x${serialNumber.toString(16).padStart(8, '0').toUpperCase()}`
            : null;

          // Parse version
          const version = properties.version || controller.version || 'Unknown';

          // Parse status and fault information
          const status = properties.status || controller.status || 0;
          const faulted = properties.faulted || controller.faulted || false;

          // Try to read Device Identity object for vendor ID
          let vendorID: number | null = null;
          let vendorName: string | null = null;
          let deviceType = 'Programmable Logic Controller';
          let deviceTypeID: number | null = null;
          let productCode: number | null = null;

          try {
            const { CIP } = EthernetIP;
            const { GET_ATTRIBUTE_SINGLE } = CIP.MessageRouter.services;
            const { LOGICAL } = CIP.EPATH.segments;

            // Helper function to read a single attribute
            const readAttribute = async (
              attributeId: number,
              attributeName: string,
            ): Promise<Buffer | null> => {
              const attributePath = Buffer.concat([
                LOGICAL.build(LOGICAL.types.ClassID, 0x01), // Identity Object (0x01)
                LOGICAL.build(LOGICAL.types.InstanceID, 0x01), // Instance ID (0x01)
                LOGICAL.build(LOGICAL.types.AttributeID, attributeId), // Attribute ID
              ]);

              const MR = CIP.MessageRouter.build(
                GET_ATTRIBUTE_SINGLE,
                attributePath,
                Buffer.alloc(0),
              );
              PLC.write_cip(MR);

              return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                  log.verbose(`Timeout reading ${attributeName}`);
                  resolve(null);
                }, 3000);

                PLC.once('Get Attribute Single', (err: Error, data: Buffer) => {
                  clearTimeout(timeout);

                  if (err) {
                    log.verbose(`Error reading ${attributeName}: ${err.message}`);
                    resolve(null);
                  } else {
                    resolve(data);
                  }
                });
              });
            };

            // Read Vendor ID (Attribute 1)
            const vendorData = await readAttribute(0x01, 'Vendor ID');

            if (vendorData && vendorData.length >= 2) {
              vendorID = vendorData.readUInt16LE(0);
              vendorName = getVendorName(vendorID);
              log.verbose(`Vendor ID: ${vendorID} -> ${vendorName}`);
            }

            // Read Device Type (Attribute 2)
            const deviceTypeData = await readAttribute(0x02, 'Device Type');

            if (deviceTypeData && deviceTypeData.length >= 2) {
              deviceTypeID = deviceTypeData.readUInt16LE(0);
              deviceType = getDeviceType(deviceTypeID);
              log.verbose(`Device Type ID: ${deviceTypeID} -> ${deviceType}`);
            }

            // Read Product Code (Attribute 3)
            const productCodeData = await readAttribute(0x03, 'Product Code');

            if (productCodeData && productCodeData.length >= 2) {
              productCode = productCodeData.readUInt16LE(0);
              log.verbose(`Product Code: ${productCode}`);
            }
          } catch (error) {
            log.verbose(`Error reading Device Identity attributes: ${error.message}`);
          }

          clearTimeout(timeoutId);
          PLC.destroy();

          resolve({
            productName,
            vendorID,
            vendorName,
            deviceTypeID,
            deviceType,
            productCode,
            serialNumber: serialHex,
            serialNumberDecimal: serialNumber,
            version,
            slot,
            status,
            faulted,
            ipAddress: this.ip,
            port: this.port,
            transportProtocol: 'TCP',
          });
        })
        .catch((error: Error) => {
          clearTimeout(timeoutId);
          PLC.destroy();
          log.verbose(`CIP TCP connection error: ${error.message}`);
          resolve(null);
        });
    });
  }

  /**
   * Get device information via UDP (List Identity command)
   */
  async getDeviceInfoUdp(): Promise<CipDeviceInfo | null> {
    return new Promise((resolve) => {
      const socket = dgram.createSocket('udp4');

      const timeoutId = setTimeout(() => {
        socket.close();
        log.verbose(`CIP UDP connection timed out after ${this.timeout}ms`);
        resolve(null);
      }, this.timeout);

      // Create a List Identity request message
      const listIdentityRequest = Buffer.from([
        0x63,
        0x00, // Command: List Identity (0x0063)
        0x00,
        0x00, // Length: 0
        0x00,
        0x00,
        0x00,
        0x00, // Session Handle: 0
        0x00,
        0x00,
        0x00,
        0x00, // Status: Success
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00, // Sender Context: 0
        0x00,
        0x00,
        0x00,
        0x00, // Options: 0
      ]);

      socket.on('message', (msg) => {
        clearTimeout(timeoutId);
        socket.close();

        try {
          // Parse the List Identity response
          if (msg.length >= 24) {
            const command = msg.readUInt16LE(0);
            const status = msg.readUInt32LE(8);

            if (command === 0x00_63 && status === 0x00_00_00_00) {
              // Parse identity items if present
              let productName = 'Unknown';
              let vendorID: number | null = null;
              let vendorName: string | null = null;
              let deviceType = 'Unknown';
              let deviceTypeID: number | null = null;
              let productCode: number | null = null;
              let serialNumber: number | null = null;
              let version = 'Unknown';

              // Look for Identity Item in the response
              if (msg.length > 24) {
                const itemCount = msg.readUInt16LE(24);
                let offset = 26;

                for (let i = 0; i < itemCount && offset < msg.length; i++) {
                  const itemType = msg.readUInt16LE(offset);
                  const itemLength = msg.readUInt16LE(offset + 2);

                  if (itemType === 0x00_0c && itemLength > 0) {
                    // Identity Item
                    const itemData = msg.slice(offset + 4, offset + 4 + itemLength);

                    if (itemData.length >= 28) {
                      vendorID = itemData.readUInt16LE(4);
                      vendorName = getVendorName(vendorID);
                      deviceTypeID = itemData.readUInt16LE(6);
                      deviceType = getDeviceType(deviceTypeID);
                      productCode = itemData.readUInt16LE(8);
                      version = `${itemData.readUInt8(10)}.${itemData.readUInt8(11)}`;

                      // Serial number is at offset 12 (4 bytes)
                      if (itemData.length >= 16) {
                        serialNumber = itemData.readUInt32LE(12);
                      }

                      // Product name starts at offset 16 (variable length string)
                      if (itemData.length > 16) {
                        const nameLength = itemData.readUInt8(16);

                        if (nameLength > 0 && itemData.length >= 17 + nameLength) {
                          productName = itemData
                            .slice(17, 17 + nameLength)
                            .toString('ascii')
                            .replaceAll('\0', '')
                            .trim();
                        }
                      }
                    }
                  }

                  offset += 4 + itemLength;
                }
              }

              const serialHex = serialNumber
                ? `0x${serialNumber.toString(16).padStart(8, '0').toUpperCase()}`
                : null;

              resolve({
                productName,
                vendorID,
                vendorName,
                deviceTypeID,
                deviceType,
                productCode,
                serialNumber: serialHex,
                serialNumberDecimal: serialNumber,
                version,
                ipAddress: this.ip,
                port: this.port,
                transportProtocol: 'UDP',
              });
            } else {
              log.verbose(
                `Invalid UDP response: Command=${command.toString(16)}, Status=${status.toString(16)}`,
              );
              resolve(null);
            }
          } else {
            log.verbose('UDP response too short');
            resolve(null);
          }
        } catch (error) {
          log.verbose(`Error parsing UDP response: ${error.message}`);
          resolve(null);
        }
      });

      socket.on('error', (error) => {
        clearTimeout(timeoutId);
        socket.close();
        log.verbose(`CIP UDP error: ${error.message}`);
        resolve(null);
      });

      socket.send(listIdentityRequest, this.port, this.ip, (err) => {
        if (err) {
          clearTimeout(timeoutId);
          socket.close();
          log.verbose(`Failed to send UDP request: ${err.message}`);
          resolve(null);
        }
      });
    });
  }

  /**
   * Discover CIP device - try TCP first, then UDP
   */
  async discover(options: CipScanOptions = {}): Promise<CipDeviceInfo | null> {
    const { slot = 0, testBoth = false } = options;

    // Quick connectivity test first
    const tcpAvailable = await testTcpPort(this.ip, this.port, 3000);
    const udpAvailable = await testUdpPort(this.ip, this.port, 3000);

    log.verbose(`CIP ${this.ip}:${this.port} - TCP: ${tcpAvailable}, UDP: ${udpAvailable}`);

    if (!tcpAvailable && !udpAvailable) {
      return null;
    }

    // Try TCP if available
    if (tcpAvailable) {
      const tcpResult = await this.getDeviceInfoTcp(slot);

      if (tcpResult) {
        return tcpResult;
      }

      // If TCP fails, try different slots
      const slotsToTry = [1, 2, 3];

      for (const trySlot of slotsToTry) {
        const slotResult = await this.getDeviceInfoTcp(trySlot);

        if (slotResult) {
          return slotResult;
        }
      }
    }

    // Try UDP if available
    if (udpAvailable) {
      const udpResult = await this.getDeviceInfoUdp();

      if (udpResult) {
        return udpResult;
      }
    }

    return null;
  }
}
