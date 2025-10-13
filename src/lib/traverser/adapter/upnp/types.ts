/**
 * TypeScript type definitions for SSDP protocol
 */

/**
 * SSDP discovery options
 */
export interface SsdpDiscoveryOptions {
  timeout?: number;
  verbose?: boolean;
}

/**
 * Service information
 */
export interface ServiceInfo {
  serviceType: string;
  serviceId: string;
  controlURL: string;
  fullControlURL: string;
  actions: string[];
}

/**
 * Device information (internal structure)
 */
export interface DeviceInfo {
  level: number;
  deviceType?: string;
  friendlyName?: string;
  manufacturer?: string;
  model?: string;
  modelNumber?: string;
  serialNumber?: string;
  UDN?: string;
  services: ServiceInfo[];
  nestedDevices: DeviceInfo[];
}

/**
 * Service collectors for special service types
 */
export interface ServiceCollectors {
  igdCtr: string | null;
  igdService: string | null;
  wanCtr: string | null;
  wanService: string | null;
}

/**
 * Port mapping information
 */
export interface PortMapping {
  protocol?: string;
  externalPort?: string;
  internalClient?: string;
  internalPort?: string;
  description?: string;
}

/**
 * Hidden action information
 */
export interface HiddenAction {
  action: string;
  serviceType: string;
  response: any;
}

/**
 * Network information
 */
export interface NetworkInfo {
  externalIP?: string;
  connectionStatus?: string;
  uptime?: number;
  wanAccessType?: string;
  natEnabled?: boolean;
  upstreamMaxBitRate?: number;
  downstreamMaxBitRate?: number;
  totalBytesSent?: number;
  totalBytesReceived?: number;
  ispUsername?: string;
  ispPassword?: string;
}

/**
 * Security information
 */
export interface SecurityInfo {
  portMappingsExposed: boolean;
  credentialsExposed: boolean;
  hiddenActionsCount: number;
}

/**
 * Services summary
 */
export interface ServicesSummary {
  count: number;
  types: string[];
  details: ServiceInfo[];
}

/**
 * SSDP device information (output)
 */
export interface SsdpDeviceInfo {
  deviceType?: string;
  role: string;
  friendlyName?: string;
  manufacturer?: string;
  model?: string;
  modelNumber?: string;
  serialNumber?: string;
  UDN?: string;
  network: Partial<NetworkInfo>;
  services: ServicesSummary;
  portMappings: PortMapping[];
  security: SecurityInfo;
}

/**
 * Discovery summary
 */
export interface DiscoverySummary {
  totalDevices: number;
  totalServices: number;
  vulnerabilities: any[];
  networkInfo: Partial<NetworkInfo>;
  portMappings: PortMapping[];
  hiddenActions: HiddenAction[];
}

/**
 * Discovery results (internal)
 */
export interface DiscoveryResults {
  devices: DeviceInfo[];
  summary: DiscoverySummary;
}

/**
 * Telegraf metric format
 */
export interface TelegrafMetric {
  name: string;
  fields: Record<string, number | string>;
  tags: Record<string, string>;
  timestamp: number;
}
