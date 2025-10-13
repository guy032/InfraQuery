/**
 * SSDP Analysis Module
 * Handles port mapping collection, network info extraction, and credential extraction
 */

import { makeSOAPRequest } from './ssdp-soap';
import type { HiddenAction, NetworkInfo, PortMapping } from './types';

/**
 * Find and collect port mappings from IGD service
 */
export async function findPortMappings(
  controlUrl: string,
  serviceType: string,
): Promise<PortMapping[]> {
  let index = 0;
  const mappings: PortMapping[] = [];

  while (index < 50) {
    // Limit to 50 mappings
    const result = await makeSOAPRequest(controlUrl, 'GetGenericPortMappingEntry', serviceType, {
      NewPortMappingIndex: index,
    });

    if (!result) {
      break;
    }

    mappings.push({
      protocol: result.NewProtocol?.[0] || undefined,
      externalPort: result.NewExternalPort?.[0] || undefined,
      internalClient: result.NewInternalClient?.[0] || undefined,
      internalPort: result.NewInternalPort?.[0] || undefined,
      description: result.NewPortMappingDescription?.[0] || undefined,
    });

    index++;
  }

  return mappings;
}

/**
 * Extract network information from WAN services
 */
export async function extractNetworkInfo(
  controlUrl: string,
  serviceType: string,
): Promise<{ networkInfo: Partial<NetworkInfo>; hiddenActions: HiddenAction[] }> {
  const actions = [
    'GetExternalIPAddress',
    'GetStatusInfo',
    'GetConnectionTypeInfo',
    'GetNATRSIPStatus',
    'GetCommonLinkProperties',
    'GetTotalBytesSent',
    'GetTotalBytesReceived',
  ];

  const networkInfo: Partial<NetworkInfo> = {};
  const hiddenActions: HiddenAction[] = [];

  for (const action of actions) {
    const result = await makeSOAPRequest(controlUrl, action, serviceType);

    if (result) {
      // Store network info
      for (const [key, value] of Object.entries(result)) {
        if (Array.isArray(value) && value.length > 0) {
          const val = value[0];

          switch (key) {
            case 'NewExternalIPAddress': {
              networkInfo.externalIP = val;
              break;
            }

            case 'NewConnectionStatus': {
              networkInfo.connectionStatus = val;
              break;
            }

            case 'NewUptime': {
              networkInfo.uptime = Number.parseInt(val, 10);
              break;
            }

            case 'NewWANAccessType': {
              networkInfo.wanAccessType = val;
              break;
            }

            case 'NewNATEnabled': {
              networkInfo.natEnabled = val === '1';
              break;
            }

            case 'NewLayer1UpstreamMaxBitRate': {
              networkInfo.upstreamMaxBitRate = Number.parseInt(val, 10);
              break;
            }

            case 'NewLayer1DownstreamMaxBitRate': {
              networkInfo.downstreamMaxBitRate = Number.parseInt(val, 10);
              break;
            }

            case 'NewTotalBytesSent': {
              networkInfo.totalBytesSent = Number.parseInt(val, 10);
              break;
            }

            case 'NewTotalBytesReceived': {
              {
                networkInfo.totalBytesReceived = Number.parseInt(val, 10);
                // No default
              }

              break;
            }
          }
        }
      }

      hiddenActions.push({ action, serviceType, response: result });
    }
  }

  return { networkInfo, hiddenActions };
}

/**
 * Test for credential extraction (potential security issue)
 */
export async function extractCredentials(
  controlUrl: string,
  serviceType: string,
): Promise<Partial<NetworkInfo>> {
  const credentials: Partial<NetworkInfo> = {};

  const userResult = await makeSOAPRequest(controlUrl, 'GetUserName', serviceType);

  if (userResult?.NewUserName?.[0]) {
    credentials.ispUsername = userResult.NewUserName[0];
  }

  const passResult = await makeSOAPRequest(controlUrl, 'GetPassword', serviceType);

  if (passResult?.NewPassword?.[0]) {
    credentials.ispPassword = passResult.NewPassword[0];
  }

  return credentials;
}
