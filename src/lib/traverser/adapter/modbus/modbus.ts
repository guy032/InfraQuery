import net from 'net';

import type {
  ModbusDeviceInfo,
  ModbusDiscoveryResult,
  ModbusFunctionCode,
  ModbusObjectMap,
  ModbusRegisterResult,
  ModbusRegisterType,
  ModbusScanOptions,
} from './types';

/**
 * Native Modbus TCP Protocol Implementation
 * Provides comprehensive Modbus device scanning and register reading
 */
export class ModbusTCP {
  private ip: string;

  private port: number;

  private timeout: number;

  private transactionId: number;

  constructor(ip: string, port = 502, timeout = 2000) {
    this.ip = ip;
    this.port = port;
    this.timeout = timeout;
    this.transactionId = 1;
  }

  /**
   * Get next transaction ID
   */
  private getNextTransactionId(): number {
    this.transactionId = (this.transactionId % 0xff_ff) + 1;

    return this.transactionId;
  }

  /**
   * Build Modbus TCP packet
   */
  private buildPacket(unitId: number, functionCode: number, data: Buffer): Buffer {
    const transactionId = this.getNextTransactionId();
    const length = data.length + 2; // Unit ID + Function Code + Data

    const header = Buffer.allocUnsafe(7);
    header.writeUInt16BE(transactionId, 0); // Transaction ID
    header.writeUInt16BE(0x00_00, 2); // Protocol ID (0 = Modbus)
    header.writeUInt16BE(length, 4); // Length
    header.writeUInt8(unitId, 6); // Unit ID

    const pdu = Buffer.allocUnsafe(1);
    pdu.writeUInt8(functionCode, 0); // Function Code

    return Buffer.concat([header, pdu, data]);
  }

  /**
   * Build device identification packet (Function Code 43)
   */
  private buildDeviceIdPacket(unitId: number): Buffer {
    const data = Buffer.allocUnsafe(3);
    data.writeUInt8(0x0e, 0); // MEI Type (Read Device Identification)
    data.writeUInt8(0x01, 1); // Read Type (Basic)
    data.writeUInt8(0x00, 2); // Object ID (Start from VendorName)

    return this.buildPacket(unitId, 0x2b, data);
  }

  /**
   * Build read holding registers packet (Function Code 3)
   */
  private buildReadHoldingRegistersPacket(
    unitId: number,
    startAddress: number,
    quantity: number,
  ): Buffer {
    const data = Buffer.allocUnsafe(4);
    data.writeUInt16BE(startAddress, 0); // Starting Address
    data.writeUInt16BE(quantity, 2); // Quantity of Registers

    return this.buildPacket(unitId, 0x03, data);
  }

  /**
   * Build read input registers packet (Function Code 4)
   */
  private buildReadInputRegistersPacket(
    unitId: number,
    startAddress: number,
    quantity: number,
  ): Buffer {
    const data = Buffer.allocUnsafe(4);
    data.writeUInt16BE(startAddress, 0); // Starting Address
    data.writeUInt16BE(quantity, 2); // Quantity of Registers

    return this.buildPacket(unitId, 0x04, data);
  }

  /**
   * Build read coils packet (Function Code 1)
   */
  private buildReadCoilsPacket(unitId: number, startAddress: number, quantity: number): Buffer {
    const data = Buffer.allocUnsafe(4);
    data.writeUInt16BE(startAddress, 0); // Starting Address
    data.writeUInt16BE(quantity, 2); // Quantity of Coils

    return this.buildPacket(unitId, 0x01, data);
  }

  /**
   * Parse all device identification objects
   */
  private parseDeviceInfo(buffer: Buffer): ModbusDeviceInfo | null {
    if (buffer.length < 14) {
      return null;
    }

    const functionCode = buffer.readUInt8(7);

    if (functionCode !== 0x2b) {
      return null;
    }

    const numberOfObjects = buffer.readUInt8(13);

    if (numberOfObjects === 0) {
      return null;
    }

    const info: ModbusDeviceInfo = {};
    let offset = 14;

    for (let i = 0; i < numberOfObjects && offset < buffer.length; i++) {
      if (offset + 2 >= buffer.length) {
        break;
      }

      const objectId = buffer.readUInt8(offset);
      const objectLength = buffer.readUInt8(offset + 1);
      offset += 2;

      if (offset + objectLength > buffer.length) {
        break;
      }

      const objectValue = buffer
        .slice(offset, offset + objectLength)
        .toString('ascii')
        .trim();
      offset += objectLength;

      // Map standard object IDs to readable names
      const objectNames: ModbusObjectMap = {
        [0x00]: 'vendor',
        [0x01]: 'product',
        [0x02]: 'version',
        [0x03]: 'vendorUrl',
        [0x04]: 'productName',
        [0x05]: 'modelName',
        [0x06]: 'userAppName',
      };

      const objectName = objectNames[objectId] || `object_${objectId}`;
      info[objectName] = objectValue;
    }

    return Object.keys(info).length > 0 ? info : null;
  }

  /**
   * Send Modbus request and receive response
   */
  private async sendRequest(packet: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let responseData = Buffer.alloc(0);

      const cleanup = () => {
        socket.removeAllListeners();
        socket.destroy();
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Modbus request timeout'));
      }, this.timeout);

      socket.on('connect', () => {
        socket.write(packet);
      });

      socket.on('data', (data: Buffer) => {
        responseData = Buffer.concat([responseData, data]);

        // Check if we have the complete response
        if (responseData.length >= 6) {
          const expectedLength = responseData.readUInt16BE(4) + 6;

          if (responseData.length >= expectedLength) {
            clearTimeout(timer);
            cleanup();
            resolve(responseData);
          }
        }
      });

      socket.on('error', (err) => {
        clearTimeout(timer);
        cleanup();
        reject(err);
      });

      socket.on('timeout', () => {
        clearTimeout(timer);
        cleanup();
        reject(new Error('Socket timeout'));
      });

      socket.setTimeout(this.timeout);
      socket.connect(this.port, this.ip);
    });
  }

  /**
   * Read holding registers (Function Code 3)
   */
  async readHoldingRegisters(
    unitId: number,
    startAddress: number,
    quantity: number,
  ): Promise<number[]> {
    const packet = this.buildReadHoldingRegistersPacket(unitId, startAddress, quantity);
    const response = await this.sendRequest(packet);

    // Check for Modbus exception
    const functionCode = response.readUInt8(7);

    if (functionCode >= 0x80) {
      throw new Error(`Modbus exception: ${response.readUInt8(8)}`);
    }

    // Parse register values
    const byteCount = response.readUInt8(8);
    const values: number[] = [];

    for (let i = 0; i < byteCount; i += 2) {
      values.push(response.readUInt16BE(9 + i));
    }

    return values;
  }

  /**
   * Read input registers (Function Code 4)
   */
  async readInputRegisters(
    unitId: number,
    startAddress: number,
    quantity: number,
  ): Promise<number[]> {
    const packet = this.buildReadInputRegistersPacket(unitId, startAddress, quantity);
    const response = await this.sendRequest(packet);

    // Check for Modbus exception
    const functionCode = response.readUInt8(7);

    if (functionCode >= 0x80) {
      throw new Error(`Modbus exception: ${response.readUInt8(8)}`);
    }

    // Parse register values
    const byteCount = response.readUInt8(8);
    const values: number[] = [];

    for (let i = 0; i < byteCount; i += 2) {
      values.push(response.readUInt16BE(9 + i));
    }

    return values;
  }

  /**
   * Read coils (Function Code 1)
   */
  async readCoils(unitId: number, startAddress: number, quantity: number): Promise<boolean[]> {
    const packet = this.buildReadCoilsPacket(unitId, startAddress, quantity);
    const response = await this.sendRequest(packet);

    // Check for Modbus exception
    const functionCode = response.readUInt8(7);

    if (functionCode >= 0x80) {
      throw new Error(`Modbus exception: ${response.readUInt8(8)}`);
    }

    // Parse coil values
    const byteCount = response.readUInt8(8);
    const coils: boolean[] = [];

    for (let i = 0; i < byteCount; i++) {
      const byte = response.readUInt8(9 + i);

      for (let bit = 0; bit < 8 && coils.length < quantity; bit++) {
        coils.push((byte & (1 << bit)) !== 0); // eslint-disable-line no-bitwise
      }
    }

    return coils.slice(0, quantity);
  }

  /**
   * Read discrete inputs (Function Code 2)
   */
  async readDiscreteInputs(
    unitId: number,
    startAddress: number,
    quantity: number,
  ): Promise<boolean[]> {
    const data = Buffer.allocUnsafe(4);
    data.writeUInt16BE(startAddress, 0);
    data.writeUInt16BE(quantity, 2);
    const packet = this.buildPacket(unitId, 0x02, data);
    const response = await this.sendRequest(packet);

    // Check for Modbus exception
    const functionCode = response.readUInt8(7);

    if (functionCode >= 0x80) {
      throw new Error(`Modbus exception: ${response.readUInt8(8)}`);
    }

    // Parse discrete inputs (same format as coils)
    const byteCount = response.readUInt8(8);
    const discreteInputs: boolean[] = [];

    for (let i = 0; i < byteCount; i++) {
      const byte = response.readUInt8(9 + i);

      for (let bit = 0; bit < 8 && discreteInputs.length < quantity; bit++) {
        discreteInputs.push((byte & (1 << bit)) !== 0); // eslint-disable-line no-bitwise
      }
    }

    return discreteInputs.slice(0, quantity);
  }

  /**
   * Get device identification for a specific unit ID
   */
  async getDeviceInfo(unitId = 1): Promise<ModbusDeviceInfo | null> {
    try {
      const packet = this.buildDeviceIdPacket(unitId);
      const response = await this.sendRequest(packet);

      if (response && response.length > 8) {
        return this.parseDeviceInfo(response);
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Perform comprehensive device discovery
   */
  async discover(options: ModbusScanOptions = {}): Promise<ModbusDiscoveryResult> {
    const {
      unitId = 1,
      timeout = 2000,
      port = 502,
      detectRegisters = false,
      maxRegisters = 10,
    } = options;

    this.timeout = timeout;
    this.port = port;

    const result: ModbusDiscoveryResult = {
      available: false,
      unitId,
      port,
    };

    try {
      // Try to get device identification
      const deviceInfo = await this.getDeviceInfo(unitId);

      if (deviceInfo) {
        result.available = true;
        result.deviceInfo = {
          ...deviceInfo,
          available: true,
          port,
          unitId,
          protocol: 'Modbus TCP',
        };
      }

      // If device identification failed, try reading a register to verify connectivity
      if (!result.available) {
        try {
          await this.readHoldingRegisters(unitId, 0, 1);
          result.available = true;
          result.deviceInfo = {
            available: true,
            port,
            unitId,
            protocol: 'Modbus TCP',
          };
        } catch {
          // Device doesn't respond
        }
      }

      // Optionally detect accessible registers
      if (result.available && detectRegisters) {
        result.registers = await this.detectRegisters(unitId, maxRegisters);
      }
    } catch {
      result.available = false;
    }

    return result;
  }

  /**
   * Detect accessible registers (reads all 4 types: holding, input, coils, discrete)
   */
  private async detectRegisters(
    unitId: number,
    maxRegisters: number,
  ): Promise<ModbusRegisterResult[]> {
    const results: ModbusRegisterResult[] = [];

    // Try reading holding registers (0-maxRegisters)
    try {
      const values = await this.readHoldingRegisters(unitId, 0, maxRegisters);

      for (const [index, value] of values.entries()) {
        results.push({
          address: index,
          value,
          type: 'holding' as ModbusRegisterType,
        });
      }
    } catch {
      // Holding registers not accessible
    }

    // Try reading input registers (0-maxRegisters)
    try {
      const values = await this.readInputRegisters(unitId, 0, maxRegisters);

      for (const [index, value] of values.entries()) {
        results.push({
          address: index,
          value,
          type: 'input' as ModbusRegisterType,
        });
      }
    } catch {
      // Input registers not accessible
    }

    // Try reading coils (0-maxRegisters)
    try {
      const values = await this.readCoils(unitId, 0, maxRegisters);

      for (const [index, coilValue] of values.entries()) {
        results.push({
          address: index,
          value: coilValue,
          type: 'coil' as ModbusRegisterType,
        });
      }
    } catch {
      // Coils not accessible
    }

    // Try reading discrete inputs (0-maxRegisters)
    try {
      const values = await this.readDiscreteInputs(unitId, 0, maxRegisters);

      for (const [index, discreteValue] of values.entries()) {
        results.push({
          address: index,
          value: discreteValue,
          type: 'discrete' as ModbusRegisterType,
        });
      }
    } catch {
      // Discrete inputs not accessible
    }

    return results;
  }
}

/**
 * Legacy class name for backward compatibility
 */
export class ModbusDeviceIdentification extends ModbusTCP {}
