/**
 * WSDL Metadata Module
 * Handles metadata exchange and hosted service discovery
 */

import type { HostedService } from './types';
import { executeSoapOperation } from './wsdl-soap-client';

/**
 * Get metadata and extract hosted service endpoints
 */
export async function getHostedServices(
  baseEndpoint: string,
  uuid: string,
  username: string | null,
  password: string | null,
  soapTimeout: number,
): Promise<Record<string, HostedService> | null> {
  try {
    // Call WS-Transfer Get to retrieve metadata
    const result = await executeSoapOperation(
      baseEndpoint,
      uuid,
      { prefix: 'wxf', type: 'MetadataExchange' },
      'Get',
      'schemas.xmlsoap.org/ws/2004/09/transfer/transfer.wsdl',
      'http://schemas.xmlsoap.org/ws/2004/09/transfer',
      {},
      null,
      null,
      true, // isMetadataExchange = true (use UUID for wsa:To)
      username,
      password,
      soapTimeout,
    );

    if (!result.jsonBody || result.error) {
      return null;
    }

    // Parse metadata to extract hosted services
    const hostedServices: Record<string, HostedService> = {};
    const metadata = result.jsonBody;

    // Extract root-level namespace declarations (e.g., metadata['msu'] = 'http://www.canon.com/ns/active/msu')
    const rootNamespaces: Record<string, string> = {};

    for (const key in metadata) {
      if (typeof metadata[key] === 'string' && metadata[key].startsWith('http')) {
        rootNamespaces[key] = metadata[key];
      }
    }

    // Map device types to service types
    const typeMapping: Record<string, string[]> = {
      ScanDeviceType: ['ScannerServiceType'],
      PrintDeviceType: ['PrinterServiceType', 'PrinterServiceV20Type'],
    };

    // Navigate through the metadata structure (could be metadata.MetadataSection or metadata.Metadata.MetadataSection)
    const metadataSections =
      metadata.MetadataSection || (metadata.Metadata && metadata.Metadata.MetadataSection);

    if (metadataSections) {
      const sections = Array.isArray(metadataSections) ? metadataSections : [metadataSections];

      for (const section of sections) {
        if (section.Relationship && section.Relationship.Hosted) {
          const hosted = Array.isArray(section.Relationship.Hosted)
            ? section.Relationship.Hosted
            : [section.Relationship.Hosted];

          for (const service of hosted) {
            if (service.Types && service.EndpointReference) {
              const types = service.Types._ || service.Types;
              const typesArray = types.split(' ');
              const endpoint = service.EndpointReference.Address;

              for (const typeStr of typesArray) {
                const [prefix, type] = typeStr.split(':');

                if (type) {
                  // Universal namespace detection (works for all vendors)
                  // 1. Try to get from Types attributes
                  let xmlns = service.Types.attributes?.[`xmlns:${prefix}`];

                  // 2. Try to get from root-level namespace declarations (e.g., json['msu'])
                  if (!xmlns && rootNamespaces[prefix]) {
                    xmlns = rootNamespaces[prefix];
                  }

                  // 3. Fallback to standard Microsoft WSD namespace
                  if (!xmlns) {
                    const namespaceMap: Record<string, string> = {
                      ScannerServiceType: 'scan',
                      PrinterServiceType: 'print',
                      PrinterServiceV20Type: 'print',
                    };
                    const namespacePath =
                      namespaceMap[type] ||
                      type.toLowerCase().replace('servicetype', '').replace('devicetype', '');
                    xmlns = `http://schemas.microsoft.com/windows/2006/08/wdp/${namespacePath}`;
                  }

                  // Store both the service type and mapped device types with their detected prefix/namespace
                  hostedServices[type] = { endpoint, prefix, xmlns };

                  // Map service types back to device types
                  for (const [deviceType, serviceTypes] of Object.entries(typeMapping)) {
                    if (serviceTypes.includes(type)) {
                      hostedServices[deviceType] = { endpoint, prefix, xmlns };
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return hostedServices;
  } catch (error) {
    console.error('Error retrieving hosted services:', error.message);

    return null;
  }
}
