/**
 * SSDP Result Transformer Module
 * Transforms raw device data into clean, structured format
 */

import type { DeviceInfo, DiscoveryResults, ServiceInfo, SsdpDeviceInfo } from './types';

/**
 * Determine device role from device type
 */
export function determineDeviceRole(deviceType: string): string {
  const roleMap = {
    InternetGatewayDevice: 'router',
    MediaServer: 'media_server',
    MediaRenderer: 'media_renderer',
    WFADevice: 'wifi_device',
    WANDevice: 'wan_device',
    LANDevice: 'lan_device',
    Printer: 'printer',
  };

  for (const [key, role] of Object.entries(roleMap)) {
    if (deviceType.includes(key)) {
      return role;
    }
  }

  return 'unknown';
}

/**
 * Collect all services from device hierarchy
 */
export function collectAllServices(device: DeviceInfo): ServiceInfo[] {
  let services: ServiceInfo[] = device.services ? [...device.services] : [];

  if (device.nestedDevices && device.nestedDevices.length > 0) {
    for (const nested of device.nestedDevices) {
      services = [...services, ...collectAllServices(nested)];
    }
  }

  return services;
}

/**
 * Find main device in hierarchy
 */
export function findMainDevice(device: DeviceInfo): DeviceInfo {
  if (
    device.deviceType?.includes('InternetGatewayDevice') ||
    device.deviceType?.includes('MediaServer')
  ) {
    return device;
  }

  for (const nested of device.nestedDevices) {
    const main = findMainDevice(nested);

    if (main) {
      return main;
    }
  }

  return device;
}

/**
 * Transform raw results into clean format
 */
export function transformResults(discoveryResults: DiscoveryResults): SsdpDeviceInfo | null {
  if (discoveryResults.devices.length === 0) {
    return null;
  }

  const device = discoveryResults.devices[0];
  const mainDevice = findMainDevice(device);
  const allServices = collectAllServices(device);
  const networkInfo = discoveryResults.summary.networkInfo;

  return {
    deviceType: mainDevice.deviceType,
    role: determineDeviceRole(mainDevice.deviceType || ''),
    friendlyName: mainDevice.friendlyName,
    manufacturer: mainDevice.manufacturer,
    model: mainDevice.model,
    modelNumber: mainDevice.modelNumber,
    serialNumber: mainDevice.serialNumber,
    UDN: mainDevice.UDN,

    network: {
      externalIP: networkInfo.externalIP || undefined,
      connectionStatus: networkInfo.connectionStatus || undefined,
      uptime: networkInfo.uptime || undefined,
      wanAccessType: networkInfo.wanAccessType || undefined,
      natEnabled: networkInfo.natEnabled || false,
      upstreamMaxBitRate: networkInfo.upstreamMaxBitRate || undefined,
      downstreamMaxBitRate: networkInfo.downstreamMaxBitRate || undefined,
      totalBytesSent: networkInfo.totalBytesSent || undefined,
      totalBytesReceived: networkInfo.totalBytesReceived || undefined,
    },

    services: {
      count: allServices.length,
      types: allServices
        .map((s) => s.serviceType?.split(':').pop())
        .filter((t): t is string => t !== undefined),
      details: allServices,
    },

    portMappings: discoveryResults.summary.portMappings,

    security: {
      portMappingsExposed: discoveryResults.summary.portMappings.length > 0,
      credentialsExposed: Boolean(networkInfo.ispUsername || networkInfo.ispPassword),
      hiddenActionsCount: discoveryResults.summary.hiddenActions.length,
    },
  };
}
