/**
 * TypeScript type definitions for Modbus protocol
 */

/**
 * Modbus device identification information
 */
export interface ModbusDeviceInfo {
  vendor?: string;
  product?: string;
  version?: string;
  vendorUrl?: string;
  productName?: string;
  modelName?: string;
  userAppName?: string;
  available?: boolean;
  port?: number;
  unitId?: number;
  protocol?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Modbus object ID mapping
 */
export type ModbusObjectMap = Record<number, string>;

/**
 * Telegraf metric format
 */
export interface TelegrafMetric {
  name: string;
  fields: Record<string, number | string>;
  tags: Record<string, string>;
  timestamp: number;
}

/**
 * Modbus post-processor options
 */
export interface ModbusOptions {
  slaveId?: number;
  unitId?: number;
  timeout?: string | number;
  [key: string]: unknown;
}

/**
 * Modbus function codes
 */
export enum ModbusFunctionCode {
  READ_COILS = 0x01,
  READ_DISCRETE_INPUTS = 0x02,
  READ_HOLDING_REGISTERS = 0x03,
  READ_INPUT_REGISTERS = 0x04,
  WRITE_SINGLE_COIL = 0x05,
  WRITE_SINGLE_REGISTER = 0x06,
  WRITE_MULTIPLE_COILS = 0x0f,
  WRITE_MULTIPLE_REGISTERS = 0x10,
  READ_DEVICE_IDENTIFICATION = 0x2b,
}

/**
 * Modbus register types
 */
export enum ModbusRegisterType {
  HOLDING = 'holding',
  INPUT = 'input',
  COIL = 'coil',
  DISCRETE = 'discrete',
}

/**
 * Modbus register read result
 */
export interface ModbusRegisterResult {
  address: number;
  value: number | boolean;
  type: ModbusRegisterType;
}

/**
 * Modbus scan options
 */
export interface ModbusScanOptions {
  unitId?: number;
  timeout?: number;
  port?: number;
  detectRegisters?: boolean;
  maxRegisters?: number;
}

/**
 * Modbus discovery result
 */
export interface ModbusDiscoveryResult {
  available: boolean;
  deviceInfo?: ModbusDeviceInfo;
  registers?: ModbusRegisterResult[];
  unitId: number;
  port: number;
}
