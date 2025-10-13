/**
 * WinRM Protocol Type Definitions
 */

/**
 * WinRM discovery options
 */
export interface WinRMDiscoveryOptions {
  timeout?: number;
}

/**
 * WinRM device information extracted from NTLM challenge
 */
export interface WinRMDeviceInfo {
  type: string;
  os: string;
  osVersion: string | null;
  osVersionNumber?: string;
  osBuild: string | null;
  hostname: string | null;
  netbiosComputerName: string | null;
  netbiosDomainName: string | null;
  fqdn: string | null;
  dnsDomainName: string | null;
  dnsTreeName: string | null;
  vendor: string;
  description: string;
  winrmEnabled: boolean;
  winrmPort: number;
  winrmProtocol: string;
}

/**
 * WinRM device metadata for Telegraf output
 */
export interface WinRMDeviceMetadata {
  type: string;
  role: string;
  vendor: string;
  description: string;
  hostname?: string;
  winrm: {
    enabled: boolean;
    port: number;
    protocol: string;
  };
  os: string;
  osVersion?: string;
  osBuild?: string;
  fqdn?: string;
  netbiosComputerName?: string;
  netbiosDomainName?: string;
  dnsDomainName?: string;
  dnsTreeName?: string;
}

/**
 * Telegraf metric output for WinRM
 */
export interface WinRMTelegrafMetric {
  fields: {
    available: number;
    winrm_service: number;
    build_number: number;
  };
  name: string;
  tags: {
    agent: string;
    protocol: string;
    port: string;
    os: string;
    hostname: string;
    transport: string;
    _device_info: string;
  };
  timestamp: number;
}
