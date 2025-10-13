/**
 * WSDL/WS-Discovery Protocol Extension
 *
 * Provides WS-Discovery capabilities for SOAP-based devices:
 * - ONVIF cameras (security, surveillance)
 * - WSD printers (Windows Web Services on Devices)
 * - WSD scanners
 * - Other SOAP/WSDL enabled devices
 *
 * Features:
 * - Device discovery via WS-Discovery probe (port 3702/UDP)
 * - Endpoint extraction
 * - Device categorization
 * - Manufacturer/model identification
 */

import type { WsdlDeviceMetadata, WsdlDiscoveryOptions, WsdlTelegrafMetric } from './types';
import { WsdlDeviceDiscovery } from './wsd';

/**
 * WSDL discovery function for network scanner
 * @param {string} agent - Target IP address
 * @param {number} port - WS-Discovery port (default 3702)
 * @param {Object} options - Discovery options
 * @returns {Promise<Array>} Array of metrics in Telegraf JSON format
 */
async function discover(
  agent: string,
  port = 3702,
  options: WsdlDiscoveryOptions = {},
): Promise<WsdlTelegrafMetric[]> {
  const { timeout = 5000, soapTimeout = 5000 } = options;

  try {
    const wsdlDevice = new WsdlDeviceDiscovery(agent, port, { timeout, soapTimeout });
    const deviceInfo = await wsdlDevice.getDeviceInfo();

    if (!deviceInfo) {
      return [];
    }

    // Build device metadata
    const deviceMetadata: WsdlDeviceMetadata = {
      endpoint: deviceInfo.endpoint || undefined,
      uuid: deviceInfo.uuid || undefined,
      deviceCategory: deviceInfo.deviceCategory || undefined,
      deviceType: deviceInfo.deviceType || undefined,
      manufacturer: deviceInfo.manufacturer || undefined,
      model: deviceInfo.model || undefined,
      macAddress: deviceInfo.macAddress || undefined,
      location: deviceInfo.location || undefined,

      // Service types discovered
      typesCount: deviceInfo.types?.length || 0,
      types: deviceInfo.types || undefined,

      // SOAP services and operations (if traversed)
      services: deviceInfo.services || undefined,
      servicesCount: Object.keys(deviceInfo.services || {}).length,
    };

    // Return metrics in Telegraf JSON format
    return [
      {
        fields: {
          // Operational metrics
          discovered: 1,
          available: 1,
          types_count: deviceInfo.types?.length || 0,
          services_count: Object.keys(deviceInfo.services || {}).length,
          operations_count: Object.values(deviceInfo.services || {}).reduce(
            (sum, service) => sum + Object.keys(service.operations || {}).length,
            0,
          ),
        },
        name: 'wsdl',
        tags: {
          agent,
          protocol: 'wsdl',
          port: String(port),
          device_category: deviceInfo.deviceCategory || 'unknown',
          // Device identification metadata in special _device_info tag
          _device_info: JSON.stringify(deviceMetadata),
        },
        timestamp: Math.floor(Date.now() / 1000),
      },
    ];
  } catch {
    // Return empty array on error (fail silently)
    return [];
  }
}

export { discover };
export type {
  DeviceServices,
  HostedService,
  ProbeMatchInfo,
  ScopeInfo,
  ServiceType,
  SoapExecutionResult,
  WsdlDeviceInfo,
  WsdlDeviceMetadata,
  WsdlDiscoveryOptions,
  WsdlTelegrafMetric,
} from './types';
export { WsdlDeviceDiscovery } from './wsd';
