/**
 * OPC-UA Protocol Module
 *
 * Complete native OPC UA implementation without Telegraf dependency.
 *
 * Features:
 * - OPC UA server discovery and device identification
 * - BuildInfo extraction (manufacturer, product, version)
 * - Server identity and status information
 * - Automatic endpoint discovery
 */

export { OpcUaDeviceIdentification } from './opcua';
export { discover, discoverOpcUaServer } from './opcua-discover';
export { opcuaPostProcessor } from './post-processor';
export type { OpcUaDeviceInfo, OpcUaOptions, OpcUaScanOptions, TelegrafMetric } from './types';
