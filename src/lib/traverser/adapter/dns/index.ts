/**
 * DNS Query Protocol Extension
 *
 * Provides DNS query testing and DNS server detection capabilities.
 *
 * Features:
 * - DNS server availability detection
 * - Query response time measurement
 * - Support for multiple record types
 * - DNS resolution testing
 */

import { DnsQueryDiscovery } from './dns';
import type { DnsQueryOptions, TelegrafMetric } from './types';

/**
 * DNS query discovery function for network scanner
 * @param {string} agent - Target DNS server IP address
 * @param {number} port - DNS port (default 53)
 * @param {Object} options - Discovery options
 * @returns {Promise<Array>} Array of metrics in Telegraf JSON format
 */
export async function discover(
  agent: string,
  port = 53,
  options: DnsQueryOptions = {},
): Promise<TelegrafMetric[]> {
  try {
    console.log(`[DNS] Starting reverse DNS lookup for ${agent}:${port}`);
    const dnsDiscovery = new DnsQueryDiscovery(agent, port, options);
    const results = await dnsDiscovery.query();

    if (!results || results.length === 0) {
      console.log(`[DNS] No results found for ${agent}:${port}`);
      return [];
    }

    // Convert results to Telegraf metrics
    const metrics: TelegrafMetric[] = [];

    for (const result of results) {
      // Extract hostname from reverse DNS lookup
      const hostname = result.answers.length > 0 ? result.answers[0] : undefined;
      
      if (hostname) {
        console.log(`[DNS] Discovered hostname for ${agent}: ${hostname}`);
      } else if (result.rcodeValue === 0) {
        console.log(`[DNS] DNS server ${agent} responded but no PTR record found`);
      } else {
        console.log(`[DNS] DNS query failed: ${result.resultCode}`);
      }
      
      // Device metadata
      const deviceInfo = {
        type: 'server',
        role: 'dns-server',
        available: result.rcodeValue === 0,
        dnsServer: true,
        responseTime: result.queryTimeMs,
        hostname: hostname, // Include discovered hostname
      };

      const tags: Record<string, string> = {
        agent,
        protocol: 'dns',
        port: String(port),
        server: `${agent}:${port}`,
        domain: result.domain,
        record_type: result.recordType,
        result: result.resultCode,
        rcode: result.resultCode,
        _device_info: JSON.stringify(deviceInfo),
      };
      
      // Add hostname as a separate tag for easy filtering
      if (hostname) {
        tags.hostname = hostname;
      }

      metrics.push({
        fields: {
          query_time_ms: result.queryTimeMs,
          rcode_value: result.rcodeValue,
          answer_count: result.answers.length,
        },
        name: 'dns_query',
        tags,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }

    return metrics;
  } catch {
    // Return empty array on error (fail silently)
    return [];
  }
}

export { DnsQueryDiscovery } from './dns';
export type { DnsDeviceMetadata, DnsQueryOptions, DnsQueryResult, TelegrafMetric } from './types';
