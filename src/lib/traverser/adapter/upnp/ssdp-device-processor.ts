/**
 * SSDP Device Processor Module
 * Handles device and service processing from UPnP XML
 */

import axios from 'axios';
import url from 'url';
import xml2js from 'xml2js';

import type { DeviceInfo, ServiceCollectors, ServiceInfo } from './types';

/**
 * Process device and its services (returns updated serviceCollectors)
 */
export async function processDevice(
  device: any,
  baseUrl: string,
  level = 0,
  serviceCollectors: ServiceCollectors | null = null,
): Promise<{ deviceInfo: DeviceInfo; serviceCollectors: ServiceCollectors }> {
  const parsedUrl = new url.URL(baseUrl);

  // Initialize serviceCollectors if not provided (root level)
  if (!serviceCollectors) {
    serviceCollectors = {
      igdCtr: null,
      igdService: null,
      wanCtr: null,
      wanService: null,
    };
  }

  const deviceInfo: DeviceInfo = {
    level,
    deviceType: device.deviceType?.[0] || undefined,
    friendlyName: device.friendlyName?.[0] || undefined,
    manufacturer: device.manufacturer?.[0] || undefined,
    model: device.modelName?.[0] || undefined,
    modelNumber: device.modelNumber?.[0] || undefined,
    serialNumber: device.serialNumber?.[0] || undefined,
    UDN: device.UDN?.[0] || undefined,
    services: [],
    nestedDevices: [],
  };

  // Process services
  const services = device.serviceList?.[0]?.service || [];

  for (const service of services) {
    const serviceType = service.serviceType[0];
    const controlURL = `${parsedUrl.protocol}//${parsedUrl.host}${service.controlURL[0].startsWith('/') ? service.controlURL[0] : '/' + service.controlURL[0]}`;

    const serviceInfo: ServiceInfo = {
      serviceType,
      serviceId: service.serviceId[0],
      controlURL: service.controlURL[0],
      fullControlURL: controlURL,
      actions: [],
    };

    // Fetch service actions
    try {
      const serviceURL = `${parsedUrl.protocol}//${parsedUrl.host}${service.SCPDURL[0].startsWith('/') ? service.SCPDURL[0] : '/' + service.SCPDURL[0]}`;
      const serviceResp = await axios.get(serviceURL, { timeout: 5000 });
      const parser = new xml2js.Parser();
      const serviceXML = await parser.parseStringPromise(serviceResp.data);
      const actions = serviceXML.scpd?.actionList?.[0]?.action || [];

      serviceInfo.actions = actions.map((action) => action.name[0]);

      // Identify key services for deep analysis
      if (serviceInfo.actions.includes('AddPortMapping')) {
        serviceCollectors.igdCtr = controlURL;
        serviceCollectors.igdService = serviceType;
      }

      if (
        serviceInfo.actions.some((a) =>
          ['GetUserName', 'GetExternalIPAddress', 'GetStatusInfo'].includes(a),
        )
      ) {
        serviceCollectors.wanCtr = controlURL;
        serviceCollectors.wanService = serviceType;
      }
    } catch {
      // Service details fetch failed
    }

    deviceInfo.services.push(serviceInfo);
  }

  // Process nested devices (pass serviceCollectors down)
  const nestedDevices = device.deviceList?.[0]?.device || [];

  for (const nestedDevice of nestedDevices) {
    const result = await processDevice(nestedDevice, baseUrl, level + 1, serviceCollectors);
    deviceInfo.nestedDevices.push(result.deviceInfo);
  }

  return { deviceInfo, serviceCollectors };
}

/**
 * Analyze SSDP device at a location URL
 */
export async function analyzeLocation(
  location: string,
): Promise<{ deviceInfo: DeviceInfo; serviceCollectors: ServiceCollectors } | null> {
  try {
    const response = await axios.get(location, { timeout: 5000 });
    const parser = new xml2js.Parser();
    const xmlRoot = await parser.parseStringPromise(response.data);

    const rootDevice = xmlRoot.root?.device?.[0];

    if (!rootDevice) {
      return null;
    }

    // Initialize serviceCollectors for collecting from all nested devices
    const serviceCollectors = {
      igdCtr: null,
      igdService: null,
      wanCtr: null,
      wanService: null,
    };

    const { deviceInfo } = await processDevice(rootDevice, location, 0, serviceCollectors);

    return { deviceInfo, serviceCollectors };
  } catch {
    return null;
  }
}
