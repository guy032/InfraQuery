/**
 * Vendor Detection from sysObjectID
 * Maps OID patterns to manufacturers
 */

import type { VendorInfo, VendorPattern } from './types';

// Vendor OID mappings from sysObjectID
export const VENDOR_PATTERNS: Record<string, VendorPattern> = {
  ibm: { pattern: /^1\.3\.6\.1\.4\.1\.2\./, name: 'IBM' },
  hp: { pattern: /^1\.3\.6\.1\.4\.1\.11\./, name: 'HP' },
  samsung: { pattern: /^1\.3\.6\.1\.4\.1\.236\./, name: 'Samsung' },
  xerox: { pattern: /^1\.3\.6\.1\.4\.1\.253\./, name: 'Xerox' },
  konica_minolta: { pattern: /^1\.3\.6\.1\.4\.1\.297\./, name: 'Konica Minolta' },
  ricoh: { pattern: /^1\.3\.6\.1\.4\.1\.367\./, name: 'Ricoh' },
  zebra: { pattern: /^1\.3\.6\.1\.4\.1\.368\./, name: 'Zebra' },
  qms: { pattern: /^1\.3\.6\.1\.4\.1\.480\./, name: 'QMS' },
  lexmark: { pattern: /^1\.3\.6\.1\.4\.1\.641\./, name: 'Lexmark' },
  toshiba: { pattern: /^1\.3\.6\.1\.4\.1\.1129\./, name: 'Toshiba' },
  seh: { pattern: /^1\.3\.6\.1\.4\.1\.1229\./, name: 'SEH' },
  epson: { pattern: /^1\.3\.6\.1\.4\.1\.1248\./, name: 'Epson' },
  kyocera: { pattern: /^1\.3\.6\.1\.4\.1\.1347\./, name: 'Kyocera' },
  canon: { pattern: /^1\.3\.6\.1\.4\.1\.1602\./, name: 'Canon' },
  oki: { pattern: /^1\.3\.6\.1\.4\.1\.2001\./, name: 'OKI' },
  sharp: { pattern: /^1\.3\.6\.1\.4\.1\.2385\./, name: 'Sharp' },
  brother: { pattern: /^1\.3\.6\.1\.4\.1\.2435\./, name: 'Brother' },
  konica_minolta_alt: { pattern: /^1\.3\.6\.1\.4\.1\.2590\./, name: 'Konica Minolta' },
  idata: { pattern: /^1\.3\.6\.1\.4\.1\.2612\./, name: 'iDATA' },
  datamax: { pattern: /^1\.3\.6\.1\.4\.1\.10917\./, name: 'Datamax' },
  konica_minolta_alt2: { pattern: /^1\.3\.6\.1\.4\.1\.18334\./, name: 'Konica Minolta' },
  kip: { pattern: /^1\.3\.6\.1\.4\.1\.21687\./, name: 'KIP' },
  riso: { pattern: /^1\.3\.6\.1\.4\.1\.24807\./, name: 'RISO' },
  hp_alt: { pattern: /^1\.3\.6\.1\.4\.1\.26696\./, name: 'HP' },
  hp_alt2: { pattern: /^1\.3\.6\.1\.4\.1\.29{4}\./, name: 'HP' },
  pantum: { pattern: /^1\.3\.6\.1\.4\.1\.40093\./, name: 'Pantum' },
};

// OID prefixes for each vendor (from user's wildcard list)
export const VENDOR_OIDS: Record<string, string[]> = {
  hp: [
    '1.3.6.1.4.1.11.2.3.9.4.2',
    '1.3.6.1.4.1.11.2.3.9.4.2.1',
    '1.3.6.1.4.1.11.2.3.9.4.2.1.1',
    '1.3.6.1.4.1.11.2.3.9.4.2.1.4',
  ],
  toshiba: ['1.3.6.1.4.1.1129.2.3.50.1.3.21.6.1.2'],
  epson: [
    '1.3.6.1.4.1.1248.1.2.2.1.1',
    '1.3.6.1.4.1.1248.1.2.2.27',
    '1.3.6.1.4.1.1248.1.2.2.28.1',
    '1.3.6.1.4.1.1248.1.2.2.6.1',
  ],
  kyocera: [
    '1.3.6.1.4.1.1347.40.10',
    '1.3.6.1.4.1.1347.42.2.1.1',
    '1.3.6.1.4.1.1347.42.2.2',
    '1.3.6.1.4.1.1347.42.3',
    '1.3.6.1.4.1.1347.43.10.1',
    '1.3.6.1.4.1.1347.46.10',
  ],
  canon: [
    '1.3.6.1.4.1.1602.1.2.1.4',
    '1.3.6.1.4.1.1602.1.11.1.3',
    '1.3.6.1.4.1.1602.1.11.1.4',
    '1.3.6.1.4.1.1602.1.11.2.1',
    '1.3.6.1.4.1.1602.1.11.2.2',
  ],
  konica_minolta: [
    '1.3.6.1.4.1.18334.1.1.1.5.7.2.2',
    '1.3.6.1.4.1.18334.1.1.1.5.7.2.3',
    '1.3.6.1.4.1.297.1.111.1.41.1.1',
  ],
  oki: ['1.3.6.1.4.1.2001.1.1.1.1.11.1.10'],
  samsung: ['1.3.6.1.4.1.236.11.5.1', '1.3.6.1.4.1.236.11.5.11.53.11'],
  sharp: ['1.3.6.1.4.1.2385.1.1.19.2'],
  brother: [
    '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.52.2',
    '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.52.21',
    '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.54.2.2',
  ],
  xerox: ['1.3.6.1.4.1.253.8.53.13.2'],
  ricoh: [
    '1.3.6.1.4.1.367.3.2.1.2',
    '1.3.6.1.4.1.367.3.2.1.2.19.5',
    '1.3.6.1.4.1.367.3.2.1.2.24.1',
  ],
  pantum: ['1.3.6.1.4.1.40093.6'],
  lexmark: ['1.3.6.1.4.1.641.2', '1.3.6.1.4.1.641.6.4.2.1'],
};

/**
 * Detect vendor from sysObjectID
 */
export function detectVendor(sysObjectID: string): VendorInfo | null {
  if (!sysObjectID) {
    return null;
  }

  for (const [key, vendor] of Object.entries(VENDOR_PATTERNS)) {
    if (vendor.pattern.test(sysObjectID)) {
      return {
        id: key,
        name: vendor.name,
        sysObjectID,
      };
    }
  }

  return {
    id: 'unknown',
    name: 'Unknown',
    sysObjectID,
  };
}

/**
 * Get vendor-specific OID list
 */
export function getVendorOIDs(vendorId: string): string[] {
  return VENDOR_OIDS[vendorId] || [];
}

/**
 * Get all vendor OID mappings
 */
export function getAllVendorOIDs(): Record<string, string[]> {
  return VENDOR_OIDS;
}
