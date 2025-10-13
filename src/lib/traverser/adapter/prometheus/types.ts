/**
 * Prometheus Protocol Types
 */

export interface PrometheusDiscoveryOptions {
  timeout?: number;
  path?: string;
}

export interface PrometheusMetric {
  name: string;
  type?: string;
  help?: string;
  value?: number | string;
  labels?: Record<string, string>;
  timestamp?: number;
}

export interface PrometheusDeviceInfo {
  type: 'server';
  prometheusEnabled: boolean;
  prometheusPort: number;
  prometheusPath: string;
  protocol: string;
  statusCode?: number;
  statusMessage?: string;
  contentType?: string;
  metricsCount: number;
  metrics?: PrometheusMetric[];
  metricFamilies?: string[];
  scrapeTimestamp: number;
}
