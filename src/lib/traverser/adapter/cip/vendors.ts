/**
 * CIP Vendor Identification Database
 * Based on ODVA (Open DeviceNet Vendor Association) vendor IDs
 */

export interface VendorInfo {
  name: string;
  models: Record<string, string>;
}

/* eslint-disable quote-props */
export const VENDOR_IDS: Record<number, VendorInfo> = {
  1: {
    name: 'Rockwell Automation/Allen-Bradley',
    models: {
      ControlLogix: 'PLC',
      CompactLogix: 'PLC',
      MicroLogix: 'PLC',
      SLC: 'PLC',
      'PLC-5': 'PLC',
      PowerFlex: 'Drive',
      Kinetix: 'Servo Drive',
      PanelView: 'HMI',
      FactoryTalk: 'Software',
    },
  },
  4: {
    name: 'HMS Industrial Networks',
    models: {
      Anybus: 'Gateway',
      eWON: 'Remote Access',
      Intesis: 'Gateway',
    },
  },
  5: {
    name: 'Schneider Electric',
    models: {
      Modicon: 'PLC',
      M340: 'PLC',
      M580: 'PLC',
      Premium: 'PLC',
      Quantum: 'PLC',
      Altivar: 'Drive',
      Lexium: 'Servo Drive',
      Magelis: 'HMI',
    },
  },
  10: {
    name: 'Omron',
    models: {
      CJ: 'PLC',
      CP: 'PLC',
      CS: 'PLC',
      NJ: 'PLC',
      NX: 'PLC',
      MX2: 'Drive',
      RX: 'Drive',
      G5: 'Servo Drive',
      NA: 'HMI',
    },
  },
  15: {
    name: 'Bosch Rexroth',
    models: {
      IndraMotion: 'Motion Control',
      IndraLogic: 'PLC',
      IndraDrive: 'Drive',
    },
  },
  26: {
    name: 'Mitsubishi Electric',
    models: {
      MELSEC: 'PLC',
      'iQ-R': 'PLC',
      'iQ-F': 'PLC',
      Q: 'PLC',
      L: 'PLC',
      FX: 'PLC',
      FR: 'Drive',
      GOT: 'HMI',
    },
  },
  42: {
    name: 'Siemens',
    models: {
      SIMATIC: 'PLC',
      S7: 'PLC',
      SINAMICS: 'Drive',
      SIMOTION: 'Motion Control',
      SINUMERIK: 'CNC',
      SIMOCODE: 'Motor Management',
      SIRIUS: 'Switching Device',
      SCALANCE: 'Network Component',
    },
  },
  59: {
    name: 'Yaskawa',
    models: {
      MP: 'Controller',
      Sigma: 'Servo Drive',
      V1000: 'Drive',
      A1000: 'Drive',
      GA700: 'Drive',
    },
  },
  83: {
    name: 'Eaton',
    models: {
      XC: 'PLC',
      XVS: 'HMI',
      PowerXL: 'Drive',
      'SmartWire-DT': 'Connection System',
    },
  },
  101: {
    name: 'Beckhoff',
    models: {
      TwinCAT: 'Software',
      CX: 'Embedded PC',
      AX: 'Servo Drive',
      EL: 'EtherCAT Terminal',
      EP: 'EtherCAT Box',
    },
  },
  283: {
    name: 'ABB',
    models: {
      AC500: 'PLC',
      ACS: 'Drive',
      DCS800: 'Drive',
      CP600: 'HMI',
    },
  },
  1281: {
    name: 'Phoenix Contact',
    models: {
      PLCnext: 'PLC',
      ILC: 'PLC',
      RFC: 'PLC',
      Axioline: 'I/O System',
    },
  },
};
/* eslint-enable quote-props */

// Device type mapping
export const DEVICE_TYPE_MAP: Record<number, string> = {
  12: 'Communications Adapter',
  14: 'Programmable Logic Controller',
  43: 'I/O Scanner',
  46: 'Position Controller',
};

/**
 * Get vendor name from vendor ID
 */
export function getVendorName(vendorID: number): string {
  return VENDOR_IDS[vendorID]?.name || `Unknown Vendor (ID: ${vendorID})`;
}

/**
 * Get device type from device type ID
 */
export function getDeviceType(deviceTypeID: number): string {
  return DEVICE_TYPE_MAP[deviceTypeID] || 'Unknown Device Type';
}

/**
 * Extract model information from product name
 */
export function extractModelInfo(
  productName: string | null,
  vendorID: number | null,
): { model: string; deviceType: string } {
  if (!productName || typeof productName !== 'string') {
    return { model: 'Unknown', deviceType: 'CIP Device' };
  }

  const vendor = vendorID ? VENDOR_IDS[vendorID] : null;

  if (vendor) {
    // Check if the product name contains any known model names
    for (const [modelName, deviceType] of Object.entries(vendor.models)) {
      if (productName.includes(modelName)) {
        return {
          model: modelName,
          deviceType,
        };
      }
    }
  }

  // If no specific model is found, try to extract a generic model name
  const modelPatterns = [
    /model:\s*([\da-z-]+)/i,
    /type:\s*([\da-z-]+)/i,
    /series:\s*([\da-z-]+)/i,
    /([a-z]+)[\s-]?(\d+)/i,
  ];

  for (const pattern of modelPatterns) {
    const match = productName.match(pattern);

    if (match && match[1]) {
      return {
        model: match[1],
        deviceType: 'CIP Device',
      };
    }
  }

  // If no model information can be extracted, return the product name as the model
  return {
    model: productName,
    deviceType: 'CIP Device',
  };
}
