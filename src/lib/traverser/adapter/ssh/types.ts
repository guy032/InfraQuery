/**
 * SSH Protocol Type Definitions
 */

/**
 * SSH discovery options
 */
export interface SSHDiscoveryOptions {
  timeout?: number;
}

/**
 * SSH device information extracted from banner
 */
export interface SSHDeviceInfo {
  banner: string;
  protocol: string | null;
  software: string | null;
  version: string | null;
  os: string | null;
  osVersion: string | null;
  osDistribution: string | null;
  vendor: string | null;
  description: string | null;
  type: string;
}

/**
 * SSH device metadata for Telegraf output
 */
export interface SSHDeviceMetadata {
  type: string;
  role: string;
  vendor?: string;
  description?: string;
  ssh: {
    protocol?: string;
    software?: string;
    version?: string;
    banner?: string;
  };
  os?: string;
  osVersion?: string;
  osDistribution?: string;
}

/**
 * Telegraf metric output for SSH
 */
export interface SSHTelegrafMetric {
  fields: {
    available: number;
    protocol_version: number;
    ssh_service: number;
  };
  name: string;
  tags: {
    agent: string;
    protocol: string;
    port: string;
    ssh_software: string;
    ssh_version: string;
    os: string;
    _device_info: string;
  };
  timestamp: number;
}
