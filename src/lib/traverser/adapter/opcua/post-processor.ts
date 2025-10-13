/**
 * OPC-UA Post-Processor
 *
 * Enhances Telegraf OPC-UA metrics with device identification via OPC-UA server queries.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
import log from '../../lib/infrastructure/logger';
import { OpcUaDeviceIdentification } from './opcua';
import type { OpcUaOptions, TelegrafMetric } from './types';

/**
 * OPC-UA post-processor - adds device identification
 */
export async function opcuaPostProcessor(
  agent: string,
  port: number,
  options: OpcUaOptions,
  metrics: TelegrafMetric[],
): Promise<TelegrafMetric[]> {
  log.verbose(`Retrieving OPC-UA device identification...`);

  try {
    const deviceId = new OpcUaDeviceIdentification(agent, port);
    const deviceInfo = await deviceId.getDeviceInfo();

    if (deviceInfo) {
      // Universal approach: Add device info as special _device_info tag
      // The formatter will extract this and place it at protocol level
      const opcuaDeviceData = {
        fields: {}, // Empty fields - this is pure metadata (Telegraf format uses 'fields')
        name: 'opcua',
        tags: {
          agent,
          protocol: 'opcua',
          _device_info: JSON.stringify({
            product: deviceInfo.productName || undefined,
            manufacturer: deviceInfo.manufacturerName || undefined,
            softwareVersion: deviceInfo.softwareVersion || undefined,
            buildNumber: deviceInfo.buildNumber || undefined,
            deviceType: deviceInfo.deviceType || undefined,
            serverIdentity: deviceInfo.serverIdentity || undefined,
            ...(deviceInfo.startTime && { startTime: deviceInfo.startTime.toISOString() }),
            ...(deviceInfo.currentTime && { currentTime: deviceInfo.currentTime.toISOString() }),
          }),
        },
        timestamp: Math.floor(Date.now() / 1000),
      };
      metrics.push(opcuaDeviceData);
      log.verbose(
        `✓ Device: ${deviceInfo.manufacturerName || 'Unknown'} ${deviceInfo.productName || 'Unknown'}`,
      );
    }
  } catch (error) {
    log.verbose(`Could not retrieve OPC-UA device identification: ${error.message}`);
  }

  return metrics;
}
