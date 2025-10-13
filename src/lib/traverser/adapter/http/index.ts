/**
 * HTTP/HTTPS Protocol Module
 *
 * Collects raw HTTP/HTTPS response data without interpretation.
 *
 * Features:
 * - HTTP/HTTPS service detection
 * - Raw HTTP header collection (Server, X-Powered-By, etc.)
 * - SSL/TLS certificate information extraction
 * - Response status code capture
 * - No device type guessing - just raw data
 */

export { default as HTTPDiscovery } from './http';
export { discover } from './http-discover';
export type { CertificateSubject, HTTPDeviceInfo, HTTPDiscoveryOptions, SSLInfo } from './types';
