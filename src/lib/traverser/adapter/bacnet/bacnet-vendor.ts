/**
 * BACnet Vendor Management
 */

import fs from 'fs';
import path from 'path';

import type { VendorEntry } from './types';

export class BACnetVendorManager {
  private vendors: VendorEntry[] = [];

  constructor() {
    this.loadVendors();
  }

  /**
   * Load vendors from vendors.json file
   */
  private loadVendors() {
    try {
      const vendorsPath = path.join(__dirname, '../../../data/bacnet-vendors.json');
      // console.log(`BACnet: Loading vendors from: ${vendorsPath}`);
      const vendorsData = fs.readFileSync(vendorsPath, 'utf8');
      this.vendors = JSON.parse(vendorsData);
    } catch (error: any) {
      console.log('BACnet: Failed to load vendors.json:', error.message);
      this.vendors = [];
    }
  }

  /**
   * Get vendor name from vendor ID using vendors.json
   */
  getVendorNameFromId(vendorId: number | null): string {
    console.log(
      `BACnet: getVendorNameFromId called with: ${vendorId}, vendors loaded: ${this.vendors.length}`,
    );

    if (vendorId === null) {
      console.log('BACnet: Vendor ID is null, returning Unknown Vendor');

      return 'Unknown Vendor';
    }

    // Try to find in loaded vendors.json
    if (this.vendors.length > 0) {
      const vendor = this.vendors.find((v) => v['Vendor ID'] === vendorId);

      if (vendor) {
        console.log(
          `BACnet: ✓ Found vendor ${vendorId} in vendors.json (${this.vendors.length} entries): ${vendor.Organization}`,
        );

        return vendor.Organization;
      }

      console.log(
        `BACnet: ✗ Vendor ${vendorId} not found in vendors.json (searched ${this.vendors.length} entries)`,
      );
    } else {
      console.log('BACnet: ⚠ vendors.json not loaded');
    }

    // No hardcoded fallbacks - only use vendors.json
    console.log(`BACnet: Returning Unknown Vendor for ID ${vendorId}`);

    return `Unknown Vendor (ID: ${vendorId})`;
  }
}
