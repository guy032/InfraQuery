/**
 * Modbus Protocol - Native Implementation
 *
 * Complete native Modbus TCP implementation without Telegraf dependency.
 *
 * Features:
 * - Device identification via Function Code 43 (MEI)
 * - Read holding registers, input registers, coils
 * - Auto-discovery with multiple unit ID support
 * - Vendor, product, and version extraction
 * - Register detection and sampling
 */

export { ModbusDeviceIdentification, ModbusTCP } from './modbus';
export { discover, discoverModbusDevice, discoverModbusDeviceMultiUnit } from './modbus-discover';
export { modbusPostProcessor } from './post-processor';
export {
  type ModbusDeviceInfo,
  type ModbusDiscoveryResult,
  ModbusFunctionCode,
  type ModbusObjectMap,
  type ModbusOptions,
  type ModbusRegisterResult,
  ModbusRegisterType,
  type ModbusScanOptions,
  type TelegrafMetric,
} from './types';
