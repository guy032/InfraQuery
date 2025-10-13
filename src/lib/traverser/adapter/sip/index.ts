/**
 * SIP Protocol Extension
 *
 * Provides SIP (Session Initiation Protocol) device discovery capabilities
 * for VoIP phones, PBX systems, and other SIP-enabled devices.
 *
 * Features:
 * - Device identification via SIP OPTIONS request
 * - User-Agent and Server header extraction
 * - Vendor, model, and version extraction
 * - Native UDP SIP implementation
 */

import { SipDeviceDiscovery } from './sip';
import type { SipDiscoveryOptions, TelegrafMetric } from './types';

/**
 * SIP discovery function for network scanner
 */
export async function discover(
  agent: string,
  port = 5060,
  options: SipDiscoveryOptions = {},
): Promise<TelegrafMetric[]> {
  const { timeout = 1000 } = options; // TURBO MODE: 1 second timeout (already set in class, this is just the wrapper default)

  try {
    const sipDevice = new SipDeviceDiscovery(agent, port);
    const deviceInfo = await sipDevice.getDeviceInfo();

    if (!deviceInfo) {
      return [];
    }

    // Return metrics in Telegraf JSON format with device info in tags
    // This follows the same pattern as post-processors for consistent formatting
    return [
      {
        fields: {
          // Operational metrics (use multiple fields to prevent scalar flattening)
          status_code: deviceInfo.statusCode || 0,
          available: deviceInfo.statusCode === 200 ? 1 : 0, // Boolean metric for availability
        },
        name: 'sip',
        tags: {
          agent,
          protocol: 'sip',
          port: String(port),
          // Device identification metadata in special _device_info tag
          // The formatter will extract this into a 'device' section
          _device_info: JSON.stringify({
            vendor: deviceInfo.vendor || undefined,
            model: deviceInfo.model || undefined,
            version: deviceInfo.version || undefined,
            userAgent: deviceInfo.userAgent || undefined,
            server: deviceInfo.server || undefined,
            allow: deviceInfo.allow || undefined,
            supported: deviceInfo.supported || undefined,
          }),
        },
        timestamp: Math.floor(Date.now() / 1000),
      },
    ];
  } catch {
    // Return empty array on error (fail silently)
    return [];
  }
}

export { sipPostProcessor } from './post-processor';
export { SipDeviceDiscovery } from './sip';
export type {
  SipDeviceInfo,
  SipDiscoveryOptions,
  SipOptions,
  SipResponse,
  TelegrafMetric,
} from './types';

// Future exports can go here:
// SipRegistrationMonitor,
// SipCallAnalyzer,
// etc.
