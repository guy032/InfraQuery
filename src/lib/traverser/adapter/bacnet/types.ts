/**
 * BACnet Protocol Type Definitions
 */

export interface BACnetDiscoveryOptions {
  timeout?: number;
  maxDevices?: number;
  apduTimeout?: number;
}

export interface BACnetDevice {
  ip: string;
  port: number;
  deviceInstance: number;
  vendorId: number | null;
  vendorName: string | null;
  vendorNameLookup: string;
  model: string | null;
  firmware: string | null;
  firmwareRevision?: string;
  objectName: string;
  applicationSoftwareVersion?: string;
  supportedObjectTypes?: Array<{ type: number; name: string }>;
  maxApdu?: number;
  segmentation?: number;
}

export interface VendorEntry {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'Vendor ID': number;
  Organization: string;
}

export interface ClientConfig {
  port: number;
  apduTimeout: number;
  apduSegmentTimeout: number;
}

export interface DiscoveredDevice {
  deviceId: number;
  address: string;
  maxApdu?: number;
  segmentation?: number;
  vendorId?: number;
  objectName?: string;
}
