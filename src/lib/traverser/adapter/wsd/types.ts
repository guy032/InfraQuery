/**
 * WSDL/WS-Discovery Protocol Type Definitions
 */

/**
 * WSDL discovery options
 */
export interface WsdlDiscoveryOptions {
  timeout?: number;
  soapTimeout?: number;
  username?: string;
  user?: string;
  password?: string;
  pass?: string;
}

/**
 * Scope information extracted from WS-Discovery response
 */
export interface ScopeInfo {
  manufacturer?: string;
  model?: string;
  macAddress?: string;
  location?: string;
  name?: string | string[];
  hardware?: string | string[];
  type?: string | string[];
  [key: string]: any;
}

/**
 * Service type definition
 */
export interface ServiceType {
  prefix: string;
  type: string;
  xmlns?: string;
}

/**
 * Hosted service information
 */
export interface HostedService {
  endpoint: string;
  prefix: string;
  xmlns: string;
}

/**
 * SOAP operation result
 */
export interface OperationResult {
  error?: string;
  status?: number;
  skipped?: boolean;
}

/**
 * Service operations map
 */
export type ServiceOperations = Record<string, OperationResult | Record<string, unknown>>;

/**
 * Device services map
 */
export type DeviceServices = Record<
  string,
  {
    operations: ServiceOperations;
  }
>;

/**
 * WSDL device information
 */
export interface WsdlDeviceInfo {
  endpoint: string;
  originalEndpoint?: string;
  uuid: string;
  types: string[];
  deviceCategory: string;
  deviceType: string | null;
  manufacturer?: string;
  model?: string;
  macAddress?: string;
  location?: string;
  scopeInfo?: ScopeInfo;
  discovered: boolean;
  services: DeviceServices;
}

/**
 * Probe match information
 */
export interface ProbeMatchInfo {
  endpoint: string;
  uuid: string;
  types: string[];
  deviceCategory: string;
  deviceType: string | null;
  manufacturer?: string;
  model?: string;
  macAddress?: string;
  location?: string;
  scopeInfo: ScopeInfo;
}

/**
 * SOAP execution result
 */
export interface SoapExecutionResult {
  jsonBody?: any;
  xmlResponse?: string;
  operation: string;
  error?: any;
  status?: number;
}

/**
 * WSDL device metadata for Telegraf output
 */
export interface WsdlDeviceMetadata {
  endpoint?: string;
  uuid?: string;
  deviceCategory?: string;
  deviceType?: string;
  manufacturer?: string;
  model?: string;
  macAddress?: string;
  location?: string;
  typesCount: number;
  types?: string[];
  services?: DeviceServices;
  servicesCount: number;
}

/**
 * Telegraf metric output for WSDL
 */
export interface WsdlTelegrafMetric {
  fields: {
    discovered: number;
    available: number;
    types_count: number;
    services_count: number;
    operations_count: number;
  };
  name: string;
  tags: {
    agent: string;
    protocol: string;
    port: string;
    device_category: string;
    _device_info: string;
  };
  timestamp: number;
}
