/**
 * Prometheus Protocol Discovery Implementation
 *
 * Scrapes and collects Prometheus metrics from network endpoints
 */

import { deviceRegistry } from '../../lib/discovery/device-registry';
import PrometheusDiscovery from './prometheus';
import type { PrometheusDeviceInfo, PrometheusDiscoveryOptions } from './types';

/**
 * Prometheus discovery function for network scanner
 * @param {string} agent - Target IP address
 * @param {number} port - Prometheus port (default 9090)
 * @param {PrometheusDiscoveryOptions} options - Discovery options
 * @returns {Promise<Array>} Array of metrics in Telegraf JSON format
 */
export async function discover(
  agent: string,
  port = 9090,
  options: PrometheusDiscoveryOptions = {},
) {
  const { timeout = 2000, path = '/metrics' } = options;

  // Safety check: Skip port 9100 if device is a known printer
  if (port === 9100 && deviceRegistry.shouldSkipPort9100(agent)) {
    return []; // Return empty metrics for printers on port 9100
  }

  try {
    const prometheusDiscovery = new PrometheusDiscovery(agent, port, path);
    prometheusDiscovery.PROMETHEUS_TIMEOUT = timeout;

    const deviceInfo: PrometheusDeviceInfo = await prometheusDiscovery.discover();

    if (!deviceInfo || !deviceInfo.prometheusEnabled) {
      return [];
    }

    // Convert all metrics to key-value pairs
    const metricsKV: Record<string, number | string> = {};

    if (deviceInfo.metrics) {
      for (const metric of deviceInfo.metrics) {
        // Build metric key (include labels if present)
        let metricKey = metric.name;

        if (metric.labels && Object.keys(metric.labels).length > 0) {
          const labelStr = Object.entries(metric.labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
          metricKey = `${metric.name}{${labelStr}}`;
        }

        // Set metric value
        if (metric.value !== undefined) {
          metricsKV[metricKey] = metric.value;
        }
      }
    }

    // Build device metadata with Prometheus information
    const deviceMetadata = {
      type: 'server',
      role: 'prometheus',
      port: deviceInfo.prometheusPort,
      path: deviceInfo.prometheusPath,
      protocol: deviceInfo.protocol,
      statusCode: deviceInfo.statusCode,
      statusMessage: deviceInfo.statusMessage,
      contentType: deviceInfo.contentType,
      scrapeTimestamp: deviceInfo.scrapeTimestamp,
      // All metrics as key-value pairs
      metrics: metricsKV,
    };

    // Return metrics in Telegraf JSON format
    return [
      {
        fields: {
          available: 1,
          prometheus_service: 1,
          status_code: deviceInfo.statusCode || 0,
          ...metricsKV, // Include all metrics as fields
        },
        name: 'prometheus',
        tags: {
          agent,
          protocol: 'prometheus',
          port: String(port),
          path: deviceInfo.prometheusPath,
          transport: deviceInfo.protocol,
          status_code: String(deviceInfo.statusCode || 0),
          _device_info: JSON.stringify(deviceMetadata),
        },
        timestamp: Math.floor(Date.now() / 1000),
      },
    ];
  } catch {
    // Return empty array on error (fail silently)
    return [];
  }
}
