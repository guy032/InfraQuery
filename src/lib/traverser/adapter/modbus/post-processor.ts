/**
 * Modbus Post-Processor
 *
 * Enhances Telegraf Modbus metrics with device identification via Modbus Function Code 43 (MEI).
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
import log from '../../lib/infrastructure/logger';
import { ModbusDeviceIdentification } from './modbus';
import type { ModbusOptions, TelegrafMetric } from './types';

/**
 * Modbus post-processor - adds device identification
 */
export async function modbusPostProcessor(
  agent: string,
  port: number,
  options: ModbusOptions,
  metrics: TelegrafMetric[],
): Promise<TelegrafMetric[]> {
  const { slaveId = 1 } = options;

  log.verbose(`Retrieving Modbus device identification...`);

  try {
    const deviceId = new ModbusDeviceIdentification(agent, port);
    const deviceInfo = await deviceId.getDeviceInfo(slaveId);

    if (deviceInfo) {
      // Universal approach: Add device info as special _device_info tag
      // The formatter will extract this and place it at protocol level
      const deviceMetric = {
        name: 'modbus',
        fields: {}, // Empty fields - this is pure metadata (Telegraf format uses 'fields')
        tags: {
          agent,
          protocol: 'modbus',
          _device_info: JSON.stringify({
            vendor: deviceInfo.vendor || undefined,
            product: deviceInfo.product || undefined,
            version: deviceInfo.version || undefined,
            ...(deviceInfo.vendorUrl && { vendorUrl: deviceInfo.vendorUrl }),
            ...(deviceInfo.productName && { productName: deviceInfo.productName }),
            ...(deviceInfo.modelName && { modelName: deviceInfo.modelName }),
          }),
        },
        timestamp: Math.floor(Date.now() / 1000),
      };
      metrics.push(deviceMetric);
      log.verbose(
        `✓ Device: ${deviceInfo.vendor || 'Unknown'} ${deviceInfo.product || 'Unknown'} ${deviceInfo.version || 'Unknown'}`,
      );
    }
  } catch (error) {
    log.verbose(`Could not retrieve device identification: ${error.message}`);
  }

  return metrics;
}
