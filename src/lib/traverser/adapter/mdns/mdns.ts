import dgram from 'dgram';
import dns from 'dns-packet';

import { parseAirPlayServiceData } from './airplay';
import { parseChromecastServiceData } from './chromecast';
import { parseHttpRelatedServiceData } from './http';
import { COMMON_MDNS_SERVICES } from './service-discovery';
import type { DeviceInfo, DnsQuery, ServiceInstance } from './types';

/**
 * mDNS Device Discovery
 * Multicast DNS service discovery for network devices
 */
export class MdnsDeviceDiscovery {
  private ip: string;

  private port: number;

  constructor(ip: string, port = 5353) {
    this.ip = ip;
    this.port = port;
  }

  /**
   * Convert buffer to string safely
   */
  private bufferToString(buffer: any): string {
    if (buffer && buffer.type === 'Buffer' && Array.isArray(buffer.data)) {
      return Buffer.from(buffer.data).toString('utf8');
    } else if (Buffer.isBuffer(buffer)) {
      return buffer.toString('utf8');
    }

    return buffer;
  }

  /**
   * Create mDNS query for common services
   */
  private createMdnsQuery(): Buffer {
    const query = {
      type: 'query' as const,
      id: Math.floor(Math.random() * 65_536),
      flags: 0, // Standard query
      questions: COMMON_MDNS_SERVICES.slice(0, 10).map((service) => ({
        type: 'PTR' as const,
        name: service,
        class: 'IN' as const,
      })),
    };

    return dns.encode(query);
  }

  /**
   * Parse service-specific data based on service type
   */
  private parseServiceSpecificData(
    serviceType: string,
    txtData: Record<string, string>,
  ): Record<string, any> {
    switch (serviceType) {
      case 'http':
      case 'qdiscover':
      case 'workstation':

      // eslint-disable-next-line no-fallthrough
      case 'smb': {
        return parseHttpRelatedServiceData(serviceType, txtData);
      }

      case 'googlecast':

      // eslint-disable-next-line no-fallthrough
      case 'chromecast': {
        return parseChromecastServiceData(txtData);
      }

      case 'airplay': {
        return parseAirPlayServiceData(txtData);
      }

      default: {
        return txtData;
      }
    }
  }

  /**
   * Parse mDNS response and extract device information
   */
  private parseMdnsResponse(response: Buffer): DeviceInfo | null {
    try {
      const decoded = dns.decode(response);
      const deviceInfo: DeviceInfo = {
        services: {},
        hostname: null,
        manufacturer: null,
        model: null,
      };

      const serviceInstances = new Map<string, ServiceInstance>();
      const addressMap = new Map<string, string[]>();

      // Combine answers and additionals
      const allRecords = [...(decoded.answers || []), ...(decoded.additionals || [])];

      // First pass: Collect PTR records (service types)
      for (const answer of allRecords) {
        if (answer.type === 'PTR') {
          const serviceName = answer.data;

          if (!serviceInstances.has(serviceName)) {
            serviceInstances.set(serviceName, {
              port: null,
              target: null,
              txtData: {},
              serviceType: answer.name,
            });
          }
        }
      }

      // Second pass: Collect SRV records (port and target)
      for (const answer of allRecords) {
        if (answer.type === 'SRV' && serviceInstances.has(answer.name)) {
          const instance = serviceInstances.get(answer.name);

          if (instance) {
            instance.port = answer.data.port;
            instance.target = answer.data.target;
          }
        }
      }

      // Third pass: Collect TXT records (service data)
      for (const answer of allRecords) {
        if (answer.type === 'TXT' && serviceInstances.has(answer.name)) {
          const instance = serviceInstances.get(answer.name);

          if (instance) {
            for (const txt of answer.data) {
              const txtStr = this.bufferToString(txt);

              if (txtStr && typeof txtStr === 'string') {
                const [key, ...values] = txtStr.split('=');

                if (key) {
                  instance.txtData[key.toLowerCase()] = values.join('=') || '';
                }
              }
            }
          }
        }
      }

      // Fourth pass: Collect A/AAAA records (addresses)
      for (const answer of allRecords) {
        if (answer.type === 'A' || answer.type === 'AAAA') {
          if (!addressMap.has(answer.name)) {
            addressMap.set(answer.name, []);
          }

          addressMap.get(answer.name)?.push(answer.data);
        }
      }

      // Build services from collected data
      for (const [serviceName, instance] of serviceInstances.entries()) {
        if (instance.port && instance.target) {
          const serviceTypeMatch = instance.serviceType.match(/_(\w+)\._tcp\.local/);
          const protocol = serviceTypeMatch?.[1] || 'unknown';

          const serviceKey = `${protocol}_${instance.port}`;
          const addresses = addressMap.get(instance.target) || [];

          // Parse service-specific data
          const parsedServiceData = this.parseServiceSpecificData(protocol, instance.txtData);

          const serviceData = {
            name: serviceName.replace(`.${instance.serviceType}`, ''),
            port: instance.port,
            protocol,
            addresses,
            ...parsedServiceData,
          };

          deviceInfo.services[serviceKey] = serviceData;

          // Extract device identification from service data
          if (parsedServiceData.model && !deviceInfo.model) {
            deviceInfo.model = parsedServiceData.model;
          }

          if (
            (parsedServiceData.manufacturer || parsedServiceData.vendor) &&
            !deviceInfo.manufacturer
          ) {
            deviceInfo.manufacturer = parsedServiceData.manufacturer || parsedServiceData.vendor;
          }

          if (serviceData.name && !deviceInfo.hostname) {
            deviceInfo.hostname = serviceData.name;
          }
        }
      }

      return deviceInfo;
    } catch {
      return null;
    }
  }

  /**
   * Create individual mDNS query for a specific service
   */
  private createServiceQuery(serviceName: string): Buffer {
    const query = {
      type: 'query' as const,
      id: Math.floor(Math.random() * 65_536),
      flags: 0,
      questions: [
        {
          type: 'PTR' as const,
          name: serviceName,
          class: 'IN' as const,
        },
      ],
    };

    return dns.encode(query);
  }

  /**
   * Send individual queries with delays for better response rate
   */
  private sendIndividualQueries(client: dgram.Socket, services: string[]): () => void {
    const timeouts: NodeJS.Timeout[] = []; // Track timeouts for cleanup

    const sendNextQuery = (index = 0): void => {
      if (index >= services.length) {
        return;
      }

      const service = services[index];
      const query = this.createServiceQuery(service);

      // Check if socket is still open before sending
      try {
        client.send(query, this.port, this.ip, (err) => {
          if (!err && (client as any)._handle) {
            // Check socket is still alive
            // Stagger queries with 100ms delay
            const timeoutId = setTimeout(() => sendNextQuery(index + 1), 100);
            timeouts.push(timeoutId);
          }
        });
      } catch {
        // Socket closed, stop sending
      }
    };

    sendNextQuery();

    // Return cleanup function
    return () => {
      for (const id of timeouts) {
        clearTimeout(id);
      }
    };
  }

  /**
   * Discover mDNS device with individual service queries
   */
  async discover(timeout = 1500): Promise<DeviceInfo | null> {
    return new Promise((resolve, reject) => {
      const client = dgram.createSocket('udp4');
      let deviceInfo: DeviceInfo | null = null;
      let cleanupQueries: (() => void) | null = null;

      const timeoutHandle = setTimeout(() => {
        // Clean up any pending query timeouts
        if (cleanupQueries) {
          cleanupQueries();
        }

        client.close();
        resolve(deviceInfo);
      }, timeout);

      client.on('message', (msg: Buffer, rinfo: dgram.RemoteInfo) => {
        if (rinfo.address === this.ip) {
          const parsed = this.parseMdnsResponse(msg);

          if (parsed && Object.keys(parsed.services).length > 0) {
            // Merge services from multiple responses
            if (deviceInfo) {
              Object.assign(deviceInfo.services, parsed.services);

              if (parsed.hostname) {
                deviceInfo.hostname = parsed.hostname;
              }

              if (parsed.manufacturer) {
                deviceInfo.manufacturer = parsed.manufacturer;
              }

              if (parsed.model) {
                deviceInfo.model = parsed.model;
              }
            } else {
              deviceInfo = parsed;
            }
          }
        }
      });

      client.on('error', (err: Error) => {
        clearTimeout(timeoutHandle);
        client.close();
        reject(err);
      });

      client.on('listening', () => {
        // Send individual queries with delays
        const services = COMMON_MDNS_SERVICES.slice(0, 8); // Limit to 8 most common
        cleanupQueries = this.sendIndividualQueries(client, services);
      });

      client.bind();
    });
  }

  /**
   * Get device identification
   */
  async getDeviceInfo(): Promise<DeviceInfo | null> {
    try {
      return await this.discover();
    } catch {
      return null;
    }
  }
}
