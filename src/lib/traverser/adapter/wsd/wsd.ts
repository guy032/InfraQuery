/**
 * WS-Discovery Device Discovery
 * Discovers SOAP/WSDL devices like ONVIF cameras, printers, and scanners
 */

import type { ProbeMatchInfo, ServiceType, WsdlDeviceInfo, WsdlDiscoveryOptions } from './types';
import { getHostedServices } from './wsdl-metadata';
import { getOnvifCapabilities } from './wsdl-onvif';
import { discoverDevice } from './wsdl-protocol';
import { processServiceType } from './wsdl-service-processor';

export class WsdlDeviceDiscovery {
  private ip: string;

  private port: number;

  private timeout: number;

  private soapTimeout: number;

  private fullTraversal: boolean;

  private username?: string;

  private password?: string;

  constructor(ip: string, port = 3702, options: WsdlDiscoveryOptions = {}) {
    this.ip = ip;
    this.port = port;
    this.timeout = options.timeout || 5000; // WS-Discovery probe timeout
    this.soapTimeout = options.soapTimeout || 5000; // SOAP operation timeout
    this.fullTraversal = true; // Enable full service traversal by default
    this.username = options.username || options.user; // ONVIF username
    this.password = options.password || options.pass; // ONVIF password
  }

  /**
   * Send WS-Discovery probe and wait for response
   */
  discover(): Promise<ProbeMatchInfo | null> {
    return discoverDevice(this.ip, this.port, this.timeout);
  }

  /**
   * Replace hostname in endpoint with IP address
   * Many devices return hostnames (e.g., http://DiskStation:5357/uuid) which may not resolve
   */
  replaceHostnameWithIP(endpoint: string | undefined): string | undefined {
    if (!endpoint) {
      return endpoint;
    }

    // Replace hostname with IP address in the endpoint URL
    // Matches: http://HOSTNAME:PORT/PATH -> http://IP:PORT/PATH
    return endpoint.replace(/^(https?:\/\/)[^/:]+(:?\d*)(.*)$/, `$1${this.ip}$2$3`);
  }

  /**
   * Get complete device information with full SOAP traversal
   */
  async getDeviceInfo(options: { basicOnly?: boolean } = {}): Promise<WsdlDeviceInfo | null> {
    try {
      const discoveryInfo = await this.discover();

      if (!discoveryInfo) {
        return null;
      }

      // Replace hostname with IP in endpoint to avoid DNS resolution issues
      const originalEndpoint = discoveryInfo.endpoint;
      const resolvedEndpoint = this.replaceHostnameWithIP(originalEndpoint)!;

      const deviceData: WsdlDeviceInfo = {
        endpoint: resolvedEndpoint, // Use resolved endpoint
        originalEndpoint: originalEndpoint === resolvedEndpoint ? undefined : originalEndpoint,
        uuid: discoveryInfo.uuid,
        types: discoveryInfo.types,
        deviceCategory: discoveryInfo.deviceCategory,
        deviceType: discoveryInfo.deviceType,
        manufacturer: discoveryInfo.manufacturer,
        model: discoveryInfo.model,
        macAddress: discoveryInfo.macAddress,
        location: discoveryInfo.location,
        discovered: true,
        services: {},
      };

      // If full traversal is disabled, return basic info
      if (!this.fullTraversal || options.basicOnly) {
        return deviceData;
      }

      // For ONVIF cameras, call operations directly instead of going through generic config
      const isOnvif =
        discoveryInfo.deviceCategory === 'camera' ||
        discoveryInfo.types?.some((t) => t.includes('NetworkVideoTransmitter'));

      if (isOnvif) {
        deviceData.services = await getOnvifCapabilities(
          resolvedEndpoint,
          discoveryInfo.uuid,
          this.username || null,
          this.password || null,
          this.soapTimeout,
        );

        return deviceData;
      }

      // For non-ONVIF devices, use the generic config-based approach
      const hostedServices = await getHostedServices(
        resolvedEndpoint,
        discoveryInfo.uuid,
        this.username || null,
        this.password || null,
        this.soapTimeout,
      );

      const serviceTypes: ServiceType[] = discoveryInfo.types.map((typeString) => {
        const [prefix, type] = typeString.split(':');
        const xmlns = resolvedEndpoint.includes('onvif')
          ? 'http://www.onvif.org/ver10/device/wsdl'
          : '';

        return { prefix, type, xmlns };
      });

      for (const serviceType of serviceTypes) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const serviceData = await processServiceType(
            resolvedEndpoint,
            discoveryInfo.uuid,
            serviceType,
            hostedServices || {},
            this.username || null,
            this.password || null,
            this.soapTimeout,
          );

          if (serviceData) {
            deviceData.services[serviceData.serviceKey] = {
              operations: serviceData.results,
            };
          }
        } catch {
          // Continue with other services if one fails
        }
      }

      return deviceData;
    } catch {
      return null;
    }
  }
}
