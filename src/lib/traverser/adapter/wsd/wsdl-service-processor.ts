/**
 * WSDL Service Processor Module
 * Processes SOAP operations for service types
 */

import { getConfigByEndpointType, snakeToCamelCase } from './config';
import type { HostedService, ServiceType } from './types';
import { executeSoapOperation } from './wsdl-soap-client';

/**
 * Process all SOAP operations for a service type
 */
export async function processServiceType(
  endpoint: string,
  uuid: string,
  serviceType: ServiceType,
  hostedServices: Record<string, HostedService> = {},
  username: string | null = null,
  password: string | null = null,
  soapTimeout = 5000,
): Promise<{ serviceKey: string; results: Record<string, any> } | null> {
  const config = getConfigByEndpointType(serviceType);

  if (!config || config.type !== 'ws') {
    return null;
  }

  // Use hosted service endpoint and detected namespace if available
  const hostedService = hostedServices[serviceType.type];
  const serviceEndpoint = hostedService?.endpoint || endpoint;
  const detectedPrefix = hostedService?.prefix;
  const detectedXmlns = hostedService?.xmlns;

  const results: Record<string, any> = {};
  const serviceKey = snakeToCamelCase(serviceType.type);

  for (const action of config.actions) {
    try {
      // Use detected namespace prefix if available, otherwise use action's configured prefix
      const namespacePrefix = detectedPrefix || action.namespacePrefix;
      const xmlns = detectedXmlns || action.xmlns;

      // Create a modified serviceType with the detected prefix for prepare function
      const serviceTypeWithPrefix = {
        ...serviceType,
        prefix: namespacePrefix,
      };

      // eslint-disable-next-line no-await-in-loop
      const result = await executeSoapOperation(
        serviceEndpoint,
        uuid,
        serviceTypeWithPrefix,
        action.operation,
        action.wsdlFile,
        xmlns,
        action.body,
        action.prepare,
        namespacePrefix,
        false, // isMetadataExchange = false for service operations
        username,
        password,
        soapTimeout,
      );

      results[action.operation] = result.error
        ? {
            error: result.error.message || 'Unknown error',
            status: result.status,
          }
        : result.jsonBody;
    } catch (error) {
      results[action.operation] = {
        error: error.message || 'Unknown error',
      };
    }
  }

  return { serviceKey, results };
}
