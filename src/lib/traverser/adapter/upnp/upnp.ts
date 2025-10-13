/**
 * SSDP Device Discovery
 * Simple Service Discovery Protocol for UPnP device discovery
 */

import { extractCredentials, extractNetworkInfo, findPortMappings } from './ssdp-analysis';
import { analyzeLocation } from './ssdp-device-processor';
import { discoverLocations } from './ssdp-protocol';
import { transformResults } from './ssdp-transformer';
import type { DeviceInfo, DiscoveryResults, SsdpDeviceInfo } from './types';

export class SsdpDeviceDiscovery {
  private ip: string;

  private port: number;

  private discoveryResults: DiscoveryResults;

  constructor(ip: string, port = 1900) {
    this.ip = ip;
    this.port = port;
    this.discoveryResults = {
      devices: [],
      summary: {
        totalDevices: 0,
        totalServices: 0,
        vulnerabilities: [],
        networkInfo: {},
        portMappings: [],
        hiddenActions: [],
      },
    };
  }

  /**
   * Full UPnP discovery and analysis
   */
  async discover(timeout: number): Promise<SsdpDeviceInfo | null> {
    console.error(`[UPNP-Discovery] Step 1: Discovering locations for ${this.ip}:${this.port}`);
    const locations = await discoverLocations(this.ip, this.port, timeout);

    if (locations.size === 0) {
      console.error(`[UPNP-Discovery] No locations found for ${this.ip}:${this.port}`);
      return null;
    }

    console.error(`[UPNP-Discovery] Step 2: Found ${locations.size} location(s), analyzing...`);
    
    // Analyze all discovered locations
    for (const location of locations) {
      console.error(`[UPNP-Discovery] Analyzing location: ${location}`);
      const result = await analyzeLocation(location);
      console.error(`[UPNP-Discovery] Location analysis ${result ? 'completed' : 'failed'}`);


      if (result) {
        const { deviceInfo, serviceCollectors } = result;

        // Add device to results
        this.discoveryResults.devices.push(deviceInfo);
        this.discoveryResults.summary.totalDevices++;

        // Count services
        const countServices = (device: DeviceInfo): number => {
          let count = device.services ? device.services.length : 0;

          if (device.nestedDevices) {
            for (const nested of device.nestedDevices) {
              count += countServices(nested);
            }
          }

          return count;
        };

        this.discoveryResults.summary.totalServices += countServices(deviceInfo);

        // Skip expensive SOAP analysis (port mappings, credentials, network info)
        // These can take 50+ SOAP requests with 3s timeouts each = 150+ seconds!
        // For basic device discovery, we already have the essential info from XML
        console.error(`[UPNP-Discovery] Skipping expensive SOAP analysis (port mappings, credentials, network info)`);
        
        // Uncomment below if you need detailed router analysis (WARNING: VERY SLOW)
        /*
        if (serviceCollectors.igdCtr && serviceCollectors.igdService) {
          console.error(`[UPNP-Discovery] Step 3: Finding port mappings...`);
          const portMappings = await findPortMappings(
            serviceCollectors.igdCtr,
            serviceCollectors.igdService,
          );
          console.error(`[UPNP-Discovery] Found ${portMappings.length} port mapping(s)`);
          this.discoveryResults.summary.portMappings = portMappings;
        }

        if (serviceCollectors.wanCtr && serviceCollectors.wanService) {
          console.error(`[UPNP-Discovery] Step 4: Extracting credentials...`);
          const credentials = await extractCredentials(
            serviceCollectors.wanCtr,
            serviceCollectors.wanService,
          );
          console.error(`[UPNP-Discovery] Credentials extraction completed`);
          Object.assign(this.discoveryResults.summary.networkInfo, credentials);

          console.error(`[UPNP-Discovery] Step 5: Extracting network info...`);
          const { networkInfo, hiddenActions } = await extractNetworkInfo(
            serviceCollectors.wanCtr,
            serviceCollectors.wanService,
          );
          console.error(`[UPNP-Discovery] Network info extraction completed`);
          Object.assign(this.discoveryResults.summary.networkInfo, networkInfo);
          this.discoveryResults.summary.hiddenActions = hiddenActions;
        }
        */
      }
    }

    console.error(`[UPNP-Discovery] Step 6: Transforming results...`);
    const result = transformResults(this.discoveryResults);
    console.error(`[UPNP-Discovery] Discovery completed for ${this.ip}:${this.port}`);
    return result;
  }

  /**
   * Get device identification
   */
  async getDeviceInfo(timeout: number): Promise<SsdpDeviceInfo | null> {
    try {
      return await this.discover(timeout);
    } catch {
      return null;
    }
  }
}
