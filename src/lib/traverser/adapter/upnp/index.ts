/**
 * SSDP Protocol Extension
 *
 * Provides SSDP (Simple Service Discovery Protocol) device discovery capabilities
 * for routers, media servers, printers, and IoT devices (UPnP).
 *
 * Features:
 * - Device discovery via SSDP unicast
 * - Device description parsing
 * - Service enumeration with action lists
 * - Network information extraction
 * - Port mapping discovery
 * - Security assessment (credential exposure, hidden actions)
 */

import { SsdpDeviceDiscovery } from './upnp';
import type { SsdpDiscoveryOptions, TelegrafMetric } from './types';

/**
 * SSDP discovery function for network scanner
 */
export async function discover(
  agent: string,
  port = 1900,
  options: SsdpDiscoveryOptions = {},
): Promise<TelegrafMetric[]> {
  const { timeout = 8000, verbose = true } = options;

  try {
    if (verbose) {
      console.error(`[UPNP] Starting discovery for ${agent}:${port} (timeout: ${timeout}ms)`);
    }
    
    const ssdpDevice = new SsdpDeviceDiscovery(agent, port);
    const deviceInfo = await ssdpDevice.getDeviceInfo(timeout);

    if (!deviceInfo) {
      if (verbose) {
        console.error(`[UPNP] No device info returned for ${agent}:${port}`);
      }
      return [];
    }

    // if (verbose) {
    //   console.error(`[UPNP] Device info received for ${agent}:${port}:`, {
    //     friendlyName: deviceInfo.friendlyName,
    //     manufacturer: deviceInfo.manufacturer,
    //     model: deviceInfo.model,
    //     servicesCount: deviceInfo.services?.count
    //   });
    // }

    // Build device metadata
    const deviceMetadata = {
      role: deviceInfo.role || undefined,
      friendlyName: deviceInfo.friendlyName || undefined,
      manufacturer: deviceInfo.manufacturer || undefined,
      model: deviceInfo.model || undefined,
      modelNumber: deviceInfo.modelNumber || undefined,
      serialNumber: deviceInfo.serialNumber || undefined,
      deviceType: deviceInfo.deviceType || undefined,
      UDN: deviceInfo.UDN || undefined,

      // Network information
      network: deviceInfo.network || undefined,

      // Services
      servicesCount: deviceInfo.services?.count || 0,
      serviceTypes: deviceInfo.services?.types || undefined,

      // Port mappings
      portMappinupnpunt: deviceInfo.portMappings?.length || 0,
      portMappupnp: deviceInfo.portMappings || undefined,

      // Security
      security: deviceInfo.security || undefined,
    };

    // Return metrics in Telegraf JSON format
    const result = [
      {
        fields: {
          // Operational metrics
          services_count: deviceInfo.services?.count || 0,
          port_mappings_count: deviceInfo.portMappings?.length || 0,
          available: 1,
          uptime_seconds: deviceInfo.network?.uptime || 0,
        },
        name: 'upnp',
        tags: {
          agent,
          protocol: 'upnp',
          port: String(port),
          // Device identification metadata in special _device_info tag
          _device_info: JSON.stringify(deviceMetadata),
        },
        timestamp: Math.floor(Date.now() / 1000),
      },
    ];
    
    if (verbose) {
      console.error(`[UPNP] Returning ${result.length} metrics for ${agent}:${port}`);
    }
    
    return result;
  } catch (error: any) {
    // Log the error if verbose
    if (verbose) {
      console.error(`[UPNP] Error discovering ${agent}:${port}:`, error.message || error);
      console.error(`[UPNP] Stack:`, error.stack);
    }
    // Return empty array on error (fail silently)
    return [];
  }
}

export { SsdpDeviceDiscovery } from './upnp';
export type {
  DeviceInfo,
  DiscoveryResults,
  DiscoverySummary,
  HiddenAction,
  NetworkInfo,
  PortMapping,
  SecurityInfo,
  ServiceCollectors,
  ServiceInfo,
  ServicesSummary,
  SsdpDeviceInfo,
  SsdpDiscoveryOptions,
  TelegrafMetric,
} from './types';
