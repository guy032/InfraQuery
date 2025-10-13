/**
 * WSDL ONVIF Module
 * Handles ONVIF camera-specific capabilities
 */

import type { DeviceServices } from './types';
import { executeSoapOperation } from './wsdl-soap-client';

/**
 * Get ONVIF capabilities directly (works without authentication)
 */
export async function getOnvifCapabilities(
  endpoint: string,
  uuid: string,
  username: string | null = null,
  password: string | null = null,
  soapTimeout = 5000,
): Promise<DeviceServices> {
  const services: DeviceServices = {
    device: {
      operations: {},
    },
  };

  const devicemgmt = 'www.onvif.org/ver10/device/wsdl';
  const serviceType = {
    prefix: 'tds',
    type: 'Device',
    xmlns: `http://${devicemgmt}`,
  };

  // ONVIF operations categorized by authentication requirement
  const operations = [
    // PRE_AUTH: Guaranteed to work without authentication per ONVIF spec
    { name: 'GetServices', requiresAuth: false, preAuth: true, body: { IncludeCapability: true } },
    { name: 'GetServiceCapabilities', requiresAuth: false, preAuth: true },
    { name: 'GetWsdlUrl', requiresAuth: false, preAuth: true },

    // Additional PRE_AUTH operations (Device service specific)
    { name: 'GetHostname', requiresAuth: false, preAuth: true },
    { name: 'GetSystemDateAndTime', requiresAuth: false, preAuth: true },

    // Opportunistic: Often works without auth but not guaranteed
    { name: 'GetCapabilities', requiresAuth: false, opportunistic: true },

    // Requires authentication
    { name: 'GetDeviceInformation', requiresAuth: true },
    { name: 'GetNetworkInterfaces', requiresAuth: true },
  ];

  for (const op of operations) {
    // Skip auth-required operations if no credentials provided
    if (op.requiresAuth && !username) {
      services.device.operations[op.name] = {
        error: 'Authentication required',
        skipped: true,
      };
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await executeSoapOperation(
        endpoint,
        uuid,
        serviceType,
        op.name,
        `${devicemgmt}/devicemgmt.wsdl`,
        `http://${devicemgmt}`,
        op.body || {},
        null,
        null,
        false,
        username,
        password,
        soapTimeout,
      );

      services.device.operations[op.name] = result.error
        ? {
            error: result.error.message || 'Unknown error',
            status: result.status,
          }
        : result.jsonBody;
    } catch (error) {
      services.device.operations[op.name] = {
        error: error.message || 'Unknown error',
      };
    }
  }

  return services;
}
