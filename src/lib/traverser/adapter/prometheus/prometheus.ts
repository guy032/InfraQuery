/**
 * Prometheus Protocol Implementation
 *
 * Scrapes metrics from Prometheus-compatible endpoints
 *
 * Features:
 * - Prometheus metrics scraping
 * - Metric family detection
 * - Support for /metrics endpoint
 * - HTTP/HTTPS support
 * - Metric parsing and counting
 */

import * as http from 'http';
import * as https from 'https';

import type { PrometheusDeviceInfo, PrometheusMetric } from './types';

class PrometheusDiscovery {
  ip: string;

  port: number;

  path: string;

  PROMETHEUS_TIMEOUT: number;

  useHTTPS: boolean;

  constructor(ip: string, port = 9090, path = '/metrics') {
    this.ip = ip;
    this.port = port;
    this.path = path;
    this.PROMETHEUS_TIMEOUT = 2000; // 2 second timeout
    this.useHTTPS = port === 443 || port === 8443;
  }

  /**
   * Discover Prometheus metrics endpoint on the target host
   * @returns {Promise<PrometheusDeviceInfo>} Prometheus device information
   */
  async discover(): Promise<PrometheusDeviceInfo> {
    return new Promise((resolve, reject) => {
      const protocol = this.useHTTPS ? https : http;
      let isSettled = false;

      const options = {
        hostname: this.ip,
        port: this.port,
        path: this.path,
        method: 'GET',
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'User-Agent': 'NetworkScanner/1.0 (Prometheus)',
          // eslint-disable-next-line quote-props
          Accept: 'text/plain; version=0.0.4',
        },
        timeout: this.PROMETHEUS_TIMEOUT,
        rejectUnauthorized: false, // Allow self-signed certificates
        agent: false,
      };

      const safeResolve = (value: PrometheusDeviceInfo) => {
        if (!isSettled) {
          isSettled = true;
          resolve(value);
        }
      };

      const safeReject = (error: Error) => {
        if (!isSettled) {
          isSettled = true;
          reject(error);
        }
      };

      const req = protocol.request(options, (res) => {
        let body = '';
        let isBodyLimitExceeded = false;

        // Collect metrics response
        res.on('data', (chunk) => {
          body += chunk;

          // Limit body size to first 100KB for metrics
          if (body.length > 102_400 && !isBodyLimitExceeded) {
            isBodyLimitExceeded = true;
            res.destroy();
          }
        });

        res.on('end', () => {
          try {
            const deviceInfo = this.parsePrometheusResponse(res, body);
            safeResolve(deviceInfo);
          } catch (error) {
            safeReject(error as Error);
          }
        });

        res.on('error', (error) => {
          // If body limit was exceeded, treat as success with partial metrics
          if (isBodyLimitExceeded) {
            try {
              const deviceInfo = this.parsePrometheusResponse(res, body);
              safeResolve(deviceInfo);
            } catch (parseError) {
              safeReject(parseError as Error);
            }
          } else {
            safeReject(error);
          }
        });

        res.on('close', () => {
          // If body limit was exceeded and we haven't resolved yet, resolve with partial metrics
          if (isBodyLimitExceeded && !isSettled) {
            try {
              const deviceInfo = this.parsePrometheusResponse(res, body);
              safeResolve(deviceInfo);
            } catch (parseError) {
              safeReject(parseError as Error);
            }
          }
        });
      });

      req.on('error', (error) => {
        safeReject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        safeReject(new Error('Prometheus request timeout'));
      });

      req.end();
    });
  }

  /**
   * Parse Prometheus metrics response
   * @param {http.IncomingMessage} response - HTTP response object
   * @param {string} body - Response body with metrics
   * @returns {PrometheusDeviceInfo} Parsed device information
   */
  parsePrometheusResponse(response: http.IncomingMessage, body: string): PrometheusDeviceInfo {
    const headers = response.headers;
    const contentType = Array.isArray(headers['content-type'])
      ? headers['content-type'][0]
      : headers['content-type'] || '';

    // Check if this looks like a Prometheus metrics endpoint
    const isPrometheusMetrics =
      contentType.includes('text/plain') ||
      contentType.includes('application/openmetrics-text') ||
      body.includes('# HELP') ||
      body.includes('# TYPE');

    if (!isPrometheusMetrics || !body.trim()) {
      throw new Error('Not a Prometheus metrics endpoint');
    }

    // Parse metrics
    const { metrics, metricFamilies, metricsCount } = this.parseMetrics(body);

    return {
      type: 'server',
      prometheusEnabled: true,
      prometheusPort: this.port,
      prometheusPath: this.path,
      protocol: this.useHTTPS ? 'https' : 'http',
      statusCode: response.statusCode || 0,
      statusMessage: response.statusMessage || '',
      contentType,
      metricsCount,
      metrics, // Include all metrics
      metricFamilies,
      scrapeTimestamp: Date.now(),
    };
  }

  /**
   * Parse Prometheus metrics format
   * @param {string} body - Metrics text
   * @returns {object} Parsed metrics info
   */
  parseMetrics(body: string): {
    metrics: PrometheusMetric[];
    metricFamilies: string[];
    metricsCount: number;
  } {
    const lines = body.split('\n');
    const metrics: PrometheusMetric[] = [];
    const metricFamilies = new Set<string>();
    let currentHelp: string | undefined;
    let currentType: string | undefined;
    let currentFamily: string | undefined;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      // Parse HELP lines
      if (trimmed.startsWith('# HELP ')) {
        const { family, help } = this.parseHelpLine(trimmed);
        currentFamily = family;
        currentHelp = help;
        metricFamilies.add(currentFamily);
        continue;
      }

      // Parse TYPE lines
      if (trimmed.startsWith('# TYPE ')) {
        const { family, type } = this.parseTypeLine(trimmed);
        currentFamily = family;
        currentType = type;
        metricFamilies.add(currentFamily);
        continue;
      }

      // Skip other comments
      if (trimmed.startsWith('#')) {
        continue;
      }

      // Parse metric lines
      const metric = this.parseMetricLine(trimmed, currentType, currentHelp);

      if (metric) {
        metrics.push(metric);
      }
    }

    return {
      metrics,
      metricFamilies: [...metricFamilies],
      metricsCount: metrics.length,
    };
  }

  /**
   * Parse HELP line
   */
  private parseHelpLine(line: string): { family: string; help: string } {
    const parts = line.slice(7).split(' ');

    return {
      family: parts[0],
      help: parts.slice(1).join(' '),
    };
  }

  /**
   * Parse TYPE line
   */
  private parseTypeLine(line: string): { family: string; type: string } {
    const parts = line.slice(7).split(' ');

    return {
      family: parts[0],
      type: parts[1],
    };
  }

  /**
   * Parse metric line
   */
  private parseMetricLine(
    line: string,
    currentType?: string,
    currentHelp?: string,
  ): PrometheusMetric | null {
    const metricMatch = line.match(/^([:A-Z_a-z][\w:]*)((?:{[^}]*})?)(?:\s+(\S+)(?:\s+(\d+))?)?$/);

    if (!metricMatch) {
      return null;
    }

    const [, name, labelsPart, valueStr, timestampStr] = metricMatch;
    const labels = this.parseLabels(labelsPart);

    const metric: PrometheusMetric = {
      name,
      type: currentType,
      help: currentHelp,
      labels: Object.keys(labels).length > 0 ? labels : undefined,
    };

    if (valueStr !== undefined) {
      const numValue = Number.parseFloat(valueStr);
      metric.value = Number.isNaN(numValue) ? valueStr : numValue;
    }

    if (timestampStr) {
      metric.timestamp = Number.parseInt(timestampStr, 10);
    }

    return metric;
  }

  /**
   * Parse labels from label string
   */
  private parseLabels(labelsPart: string): Record<string, string> {
    const labels: Record<string, string> = {};

    if (!labelsPart) {
      return labels;
    }

    const labelsMatch = labelsPart.match(/{([^}]+)}/);

    if (!labelsMatch) {
      return labels;
    }

    const labelPairs = labelsMatch[1].split(',');

    for (const pair of labelPairs) {
      const [key, value] = pair.split('=').map((s) => s.trim());

      if (key && value) {
        labels[key] = value.replace(/^"(.*)"$/, '$1');
      }
    }

    return labels;
  }
}

export default PrometheusDiscovery;
