/**
 * SIP Post-Processor
 *
 * Enhances Telegraf SIP metrics with device identification via SIP OPTIONS request.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
import log from '../../lib/infrastructure/logger';
import { SipDeviceDiscovery } from './sip';
import type { SipOptions, TelegrafMetric } from './types';

/**
 * SIP post-processor - adds device identification
 */
export async function sipPostProcessor(
  agent: string,
  port: number,
  options: SipOptions,
  metrics: TelegrafMetric[],
): Promise<TelegrafMetric[]> {
  log.verbose(`Retrieving SIP device identification...`);

  try {
    const sipDevice = new SipDeviceDiscovery(agent, port);
    const deviceInfo = await sipDevice.getDeviceInfo();

    if (deviceInfo) {
      // Universal approach: Add device info as special _device_info tag
      // The formatter will extract this and place it at protocol level
      const deviceMetric = {
        name: 'sip',
        fields: {}, // Empty fields - this is pure metadata (Telegraf format uses 'fields')
        tags: {
          agent,
          protocol: 'sip',
          _device_info: JSON.stringify({
            vendor: deviceInfo.vendor || undefined,
            model: deviceInfo.model || undefined,
            version: deviceInfo.version || undefined,
            userAgent: deviceInfo.userAgent || undefined,
            server: deviceInfo.server || undefined,
            allow: deviceInfo.allow || undefined,
            supported: deviceInfo.supported || undefined,
            statusCode: deviceInfo.statusCode || undefined,
          }),
        },
        timestamp: Math.floor(Date.now() / 1000),
      };
      metrics.push(deviceMetric);

      const deviceStr =
        [deviceInfo.vendor, deviceInfo.model, deviceInfo.version].filter(Boolean).join(' ') ||
        deviceInfo.userAgent ||
        'Unknown';

      log.verbose(`✓ Device: ${deviceStr}`);
    }
  } catch (error) {
    log.verbose(`Could not retrieve device identification: ${error.message}`);
  }

  return metrics;
}
