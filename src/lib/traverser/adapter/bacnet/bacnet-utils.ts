/**
 * BACnet Utility Functions
 */

import type { BACnetDevice } from './types';

export class BACnetUtils {
  /**
   * Get object type name
   */
  static getObjectTypeName(type: number): string {
    // Complete BACnet object type names from BACnet spec
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const typeNames: Record<number, string> = {
      0: 'Analog Input',
      1: 'Analog Output',
      2: 'Analog Value',
      3: 'Binary Input',
      4: 'Binary Output',
      5: 'Binary Value',
      6: 'Calendar',
      7: 'Command',
      8: 'Device',
      9: 'Event Enrollment',
      10: 'File',
      11: 'Group',
      12: 'Loop',
      13: 'Multi-State Input',
      14: 'Multi-State Output',
      15: 'Notification Class',
      16: 'Program',
      17: 'Schedule',
      18: 'Averaging',
      19: 'Multi-State Value',
      20: 'Trend Log',
      21: 'Life Safety Point',
      22: 'Life Safety Zone',
      23: 'Accumulator',
      24: 'Pulse Converter',
      25: 'Event Log',
      26: 'Global Group',
      27: 'Trend Log Multiple',
      28: 'Load Control',
      29: 'Structured View',
      30: 'Access Door',
      31: 'Timer',
      32: 'Access Credential',
      33: 'Access Point',
      34: 'Access Rights',
      35: 'Access User',
      36: 'Access Zone',
      37: 'Credential Data Input',
      38: 'Network Security',
      39: 'Bitstring Value',
      40: 'CharacterString Value',
      41: 'Date Pattern Value',
      42: 'Date Value',
      43: 'DateTime Pattern Value',
      44: 'DateTime Value',
      45: 'Integer Value',
      46: 'Large Analog Value',
      47: 'OctetString Value',
      48: 'Positive Integer Value',
      49: 'Time Pattern Value',
      50: 'Time Value',
      51: 'Notification Forwarder',
      52: 'Alert Enrollment',
      53: 'Channel',
      54: 'Lighting Output',
    };

    return typeNames[type] || `Unknown Type (${type})`;
  }

  /**
   * Decode protocol object types bitstring
   */
  static decodeProtocolObjectTypes(bitstring: any): Array<{ type: number; name: string }> {
    if (!bitstring || !bitstring.value) {
      return [];
    }

    const supportedTypes: Array<{ type: number; name: string }> = [];
    // Complete BACnet object type names from BACnet spec
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const typeNames: Record<number, string> = {
      0: 'Analog Input',
      1: 'Analog Output',
      2: 'Analog Value',
      3: 'Binary Input',
      4: 'Binary Output',
      5: 'Binary Value',
      6: 'Calendar',
      7: 'Command',
      8: 'Device',
      9: 'Event Enrollment',
      10: 'File',
      11: 'Group',
      12: 'Loop',
      13: 'Multi-State Input',
      14: 'Multi-State Output',
      15: 'Notification Class',
      16: 'Program',
      17: 'Schedule',
      18: 'Averaging',
      19: 'Multi-State Value',
      20: 'Trend Log',
      21: 'Life Safety Point',
      22: 'Life Safety Zone',
      23: 'Accumulator',
      24: 'Pulse Converter',
      25: 'Event Log',
      26: 'Global Group',
      27: 'Trend Log Multiple',
      28: 'Load Control',
      29: 'Structured View',
      30: 'Access Door',
      31: 'Timer',
      32: 'Access Credential',
      33: 'Access Point',
      34: 'Access Rights',
      35: 'Access User',
      36: 'Access Zone',
      37: 'Credential Data Input',
      38: 'Network Security',
      39: 'Bitstring Value',
      40: 'CharacterString Value',
      41: 'Date Pattern Value',
      42: 'Date Value',
      43: 'DateTime Pattern Value',
      44: 'DateTime Value',
      45: 'Integer Value',
      46: 'Large Analog Value',
      47: 'OctetString Value',
      48: 'Positive Integer Value',
      49: 'Time Pattern Value',
      50: 'Time Value',
      51: 'Notification Forwarder',
      52: 'Alert Enrollment',
      53: 'Channel',
      54: 'Lighting Output',
    };

    for (let i = 0; i < Math.min(bitstring.bitsUsed as number, 32); i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;

      if (byteIndex < bitstring.value.length) {
        const byte = bitstring.value[byteIndex] as number;

        // eslint-disable-next-line no-bitwise
        if (byte & (1 << (7 - bitIndex))) {
          supportedTypes.push({
            type: i,
            name: typeNames[i] || `Type ${i}`,
          });
        }
      }
    }

    return supportedTypes;
  }

  /**
   * Format discovered devices into Telegraf JSON format
   */
  static formatResults(devices: BACnetDevice[], sourceAgent: string) {
    return devices.map((device) => ({
      fields: {
        device_instance: device.deviceInstance,
        object_name: device.objectName,
        vendor_id: device.vendorId,
        vendor_name_lookup: device.vendorNameLookup,
        model: device.model,
        firmware: device.firmware || device.firmwareRevision,
        application_software_version: device.applicationSoftwareVersion,
        max_apdu: device.maxApdu,
        segmentation: device.segmentation,
        supported_object_types: device.supportedObjectTypes
          ? JSON.stringify(device.supportedObjectTypes)
          : undefined,
      },
      name: 'bacnet',
      tags: {
        host: sourceAgent,
        source: device.ip,
        port: device.port,
      },
      timestamp: Math.floor(Date.now() / 1000),
    }));
  }
}
