/**
 * Prometheus Protocol Module
 *
 * Scrapes metrics from Prometheus-compatible endpoints
 *
 * Features:
 * - Prometheus metrics scraping
 * - Metric family detection
 * - HTTP/HTTPS support
 * - Metric parsing and analysis
 */

export { default as PrometheusDiscovery } from './prometheus';
export { discover } from './prometheus-discover';
export type { PrometheusDeviceInfo, PrometheusDiscoveryOptions, PrometheusMetric } from './types';
