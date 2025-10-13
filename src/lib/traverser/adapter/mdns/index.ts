/**
 * mDNS Protocol Extension
 *
 * Provides mDNS (Multicast DNS) device discovery capabilities
 * for network devices advertising services via mDNS.
 *
 * Features:
 * - Service discovery via mDNS queries
 * - Device identification from service records
 * - Support for common services (HTTP, AirPlay, Chromecast, SSH, SMB, etc.)
 * - Native UDP mDNS implementation
 */

import { deviceRegistry } from '../../lib/discovery/device-registry';
import { queryAirPlayDirect } from './airplay';
import { queryChromecastDirect } from './chromecast';
import { MdnsDeviceDiscovery } from './mdns';
import type {
  AirPlayResult,
  ChromecastResult,
  DeviceInfo,
  DeviceMetadata,
  DirectConnectionResults,
  MdnsDiscoveryOptions,
  TelegrafMetric,
} from './types';

/**
 * Try direct connections as fallback
 * Returns full service data with ALL device information preserved
 */
async function tryDirectConnections(agent: string): Promise<DirectConnectionResults | null> {
  const results: DirectConnectionResults = {
    services: {},
    manufacturer: null,
    model: null,
    hostname: null,
    fullServiceData: {}, // Store complete service data including rich AirPlay/Chromecast info
  };

  // Try Chromecast
  try {
    const chromecastResult: ChromecastResult = await queryChromecastDirect(agent);

    if (chromecastResult?.chromecast?.services) {
      Object.assign(results.services, chromecastResult.chromecast.services);

      // Flatten structure: extract first service data directly
      const firstService = Object.values(chromecastResult.chromecast.services)[0];

      if (firstService) {
        results.fullServiceData.chromecast = firstService;

        // Extract basic device info
        if (firstService.Name) {
          results.hostname = firstService.Name;
        }

        if (firstService.Manufacturer && firstService.Manufacturer !== 'Google') {
          results.manufacturer = firstService.Manufacturer;
        }

        if (firstService.Model) {
          results.model = firstService.Model;
        }
      }
    }
  } catch {
    // Silent fail for Chromecast
  }

  // Try AirPlay
  try {
    const airplayResult: AirPlayResult = await queryAirPlayDirect(agent);

    if (airplayResult?.airplay?.services) {
      Object.assign(results.services, airplayResult.airplay.services);

      // Flatten structure: extract first service data directly
      const firstService = Object.values(airplayResult.airplay.services)[0];

      if (firstService) {
        results.fullServiceData.airplay = firstService;

        // Extract basic device info (prefer AirPlay data as it's more detailed)
        if (firstService.Name && !results.hostname) {
          results.hostname = firstService.Name;
        }

        if (firstService.Manufacturer) {
          results.manufacturer = firstService.Manufacturer;
        }

        if (firstService.DeviceModel) {
          results.model = firstService.DeviceModel;
        }
      }
    }
  } catch {
    // Silent fail for AirPlay
  }

  return Object.keys(results.services).length > 0 ? results : null;
}

/**
 * mDNS discovery function for network scanner (with direct connection fallback)
 * @param agent - Target IP address
 * @param port - mDNS port (default 5353)
 * @param options - Discovery options
 * @returns Array of metrics in Telegraf JSON format
 */
export async function discover(
  agent: string,
  port = 5353,
  _options: MdnsDiscoveryOptions = {},
): Promise<TelegrafMetric[]> {
  try {
    // Try mDNS discovery and direct connections in parallel
    const mdnsDevice = new MdnsDeviceDiscovery(agent, port);
    const [mdnsResult, directResult] = await Promise.allSettled([
      mdnsDevice.getDeviceInfo(),
      tryDirectConnections(agent),
    ]);

    let deviceInfo: DeviceInfo | DirectConnectionResults | null = null;

    // Merge mDNS and direct connection results
    if (mdnsResult.status === 'fulfilled' && mdnsResult.value) {
      deviceInfo = mdnsResult.value;
    }

    if (directResult.status === 'fulfilled' && directResult.value) {
      if (deviceInfo) {
        // Merge services
        Object.assign(deviceInfo.services, directResult.value.services);

        // Prefer direct connection device info if available
        if (directResult.value.hostname) {
          deviceInfo.hostname = directResult.value.hostname;
        }

        if (directResult.value.manufacturer) {
          deviceInfo.manufacturer = directResult.value.manufacturer;
        }

        if (directResult.value.model) {
          deviceInfo.model = directResult.value.model;
        }

        if (directResult.value.fullServiceData) {
          deviceInfo.fullServiceData = directResult.value.fullServiceData;
        }
      } else {
        deviceInfo = directResult.value;
      }
    }

    if (!deviceInfo || Object.keys(deviceInfo.services).length === 0) {
      return [];
    }

    // Count total services discovered
    const serviceCount = Object.keys(deviceInfo.services).length;
    const serviceList = Object.keys(deviceInfo.services).join(', ');

    // Detect printer services and mark in registry
    const printerServices = new Set([
      '_ipp._tcp.local',
      '_printer._tcp.local',
      '_ipps._tcp.local',
      '_pdl-datastream._tcp.local',
    ]);
    const isPrinter = Object.keys(deviceInfo.services).some((service) =>
      printerServices.has(service),
    );

    if (isPrinter) {
      deviceRegistry.markAsPrinter(agent, 'mdns', {
        services: serviceList,
        hostname: deviceInfo.hostname,
        manufacturer: deviceInfo.manufacturer,
        model: deviceInfo.model,
      });
    }

    // Build comprehensive device info including full service data
    const deviceMetadata: DeviceMetadata = {
      hostname: deviceInfo.hostname || undefined,
      manufacturer: deviceInfo.manufacturer || undefined,
      model: deviceInfo.model || undefined,
      services: serviceList || undefined,
      serviceCount,
    };

    // Add full service data (AirPlay/Chromecast details)
    if (deviceInfo.fullServiceData) {
      if (deviceInfo.fullServiceData.airplay) {
        deviceMetadata.airplay = deviceInfo.fullServiceData.airplay;
      }

      if (deviceInfo.fullServiceData.chromecast) {
        deviceMetadata.chromecast = deviceInfo.fullServiceData.chromecast;
      }
    }

    // Return metrics in Telegraf JSON format with device info in tags
    return [
      {
        fields: {
          // Operational metrics
          services_count: serviceCount,
          available: 1, // Boolean metric for availability
        },
        name: 'mdns',
        tags: {
          agent,
          protocol: 'mdns',
          port: String(port),
          // Device identification metadata in special _device_info tag
          // NOTE: This can be large with AirPlay data, but it's rich device information
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

// Re-export the class for external use
export { MdnsDeviceDiscovery } from './mdns';
