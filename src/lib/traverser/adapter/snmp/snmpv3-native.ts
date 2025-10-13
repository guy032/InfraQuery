/**
 * SNMPv3 Native Protocol Discovery
 * Native protocol wrapper for SNMPv3 discovery
 */

import { discoverSNMPv3 } from './snmpv3-discovery';

/**
 * Discover SNMPv3 device (native protocol interface)
 */
export async function discover(
  agent: string,
  _port: number | null,
  options: { timeout?: number } = {},
): Promise<Array<{ name: string; fields: Record<string, unknown>; tags: Record<string, string> }>> {
  const timeout = options.timeout || 3000;
  const result = await discoverSNMPv3(agent, timeout);

  if (!result.success) {
    return [];
  }

  // Return in Telegraf metric format
  return [
    {
      name: 'snmpv3',
      tags: {
        agent,
        enterprise: result.enterpriseName || 'unknown',
        engine_format: result.engineIDFormat || 'unknown',
      },
      fields: {
        enterprise_id: result.enterprise || 0,
        enterprise_name: result.enterpriseName || 'unknown',
        engine_format: result.engineIDFormat || 'unknown',
        engine_data: result.engineIDData || '',
        engine_boots: result.engineBoots || 0,
        engine_time: result.engineTime || 0,
        engine_time_formatted: result.engineTimeFormatted || '',
        engine_id_raw: result.raw || '',
      },
    },
  ];
}
