/**
 * CIP/EtherNet-IP Protocol Module
 *
 * Complete native CIP implementation without Telegraf dependency.
 *
 * Features:
 * - CIP/EtherNet-IP device discovery (TCP and UDP)
 * - Device identification (vendor, product, version, serial number)
 * - Multiple slot attempts for TCP connections
 * - List Identity command for UDP
 * - Rockwell Automation/Allen-Bradley support
 * - Wide vendor support (Siemens, Schneider, Omron, etc.)
 */

export { CipClient } from './cip';
export { discover, discoverCipDevice } from './cip-discover';
export { cipPostProcessor } from './post-processor';
export type { CipDeviceInfo, CipDiscoveryResult, CipOptions, CipScanOptions } from './types';
export { extractModelInfo, getDeviceType, getVendorName, VENDOR_IDS } from './vendors';
