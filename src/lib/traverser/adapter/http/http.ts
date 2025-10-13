/**
 * HTTP/HTTPS Protocol Implementation
 *
 * Collects raw HTTP/HTTPS response data for network device discovery
 *
 * Features:
 * - HTTP/HTTPS service detection
 * - Raw HTTP header collection
 * - SSL/TLS certificate information extraction
 * - Response status code capture
 * - No interpretation or guessing - just raw data collection
 */

import { EventEmitter } from 'events';
import * as http from 'http';
import * as https from 'https';
import type { PeerCertificate, TLSSocket } from 'tls';

import type { CertificateSubject, HTTPDeviceInfo, SSLInfo } from './types';

class HTTPDiscovery extends EventEmitter {
  ip: string;

  port: number;

  HTTP_TIMEOUT: number;

  useHTTPS: boolean;

  constructor(ip: string, port = 80) {
    super();
    this.ip = ip;
    this.port = port;
    this.HTTP_TIMEOUT = 1000; // 1 second timeout (optimized for speed)
    this.useHTTPS = port === 443 || port === 8443;
  }

  /**
   * Discover HTTP/HTTPS service on the target host
   * @returns {Promise<HTTPDeviceInfo>} HTTP device information
   */
  async discover(): Promise<HTTPDeviceInfo> {
    return new Promise((resolve, reject) => {
      const protocol = this.useHTTPS ? https : http;
      let isSettled = false; // Track if promise has been resolved/rejected

      const options = {
        hostname: this.ip,
        port: this.port,
        path: '/',
        method: 'GET', // Use GET to collect body content
        headers: {
          'User-Agent': 'NetworkScanner/1.0',
          // eslint-disable-next-line quote-props
          Accept: '*/*',
        },
        timeout: this.HTTP_TIMEOUT,
        rejectUnauthorized: false, // Allow self-signed certificates
        // Get certificate info for HTTPS
        agent: false,
      };

      const safeResolve = (value: HTTPDeviceInfo) => {
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
        // Collect response data
        let body = '';
        let bodyLimitExceeded = false;

        // Try to get some body content for better detection
        res.on('data', (chunk) => {
          body += chunk;

          // Limit body size to first 10KB
          if (body.length > 10_240 && !bodyLimitExceeded) {
            bodyLimitExceeded = true;
            res.destroy();
          }
        });

        res.on('end', () => {
          try {
            const deviceInfo = this.parseHTTPResponse(res, body);

            // Get SSL certificate info if HTTPS
            if (this.useHTTPS && res.socket) {
              const tlsSocket = res.socket as TLSSocket;
              const cert = tlsSocket.getPeerCertificate();

              if (cert && Object.keys(cert).length > 0) {
                deviceInfo.ssl = this.parseCertificate(cert);
              }
            }

            safeResolve(deviceInfo);
          } catch (error) {
            safeReject(error as Error);
          }
        });

        // Handle response errors (e.g., when destroy() is called)
        res.on('error', (error) => {
          // If body limit was exceeded, treat as success with partial body
          if (bodyLimitExceeded) {
            try {
              const deviceInfo = this.parseHTTPResponse(res, body);
              safeResolve(deviceInfo);
            } catch (parseError) {
              safeReject(parseError as Error);
            }
          } else {
            safeReject(error);
          }
        });

        // Handle response close event (when destroy() is called)
        res.on('close', () => {
          // If body limit was exceeded and we haven't resolved yet, resolve with partial body
          if (bodyLimitExceeded && !isSettled) {
            try {
              const deviceInfo = this.parseHTTPResponse(res, body);
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
        safeReject(new Error('HTTP request timeout'));
      });

      req.end();
    });
  }

  /**
   * Parse HTTP response to extract device information
   * @param {http.IncomingMessage} response - HTTP response object
   * @param {string} body - Response body
   * @returns {HTTPDeviceInfo} Parsed device information
   */
  parseHTTPResponse(response: http.IncomingMessage, body: string): HTTPDeviceInfo {
    const headers = response.headers;

    return {
      type: 'server',
      httpEnabled: true,
      httpPort: this.port,
      httpProtocol: this.useHTTPS ? 'https' : 'http',
      statusCode: response.statusCode || 0,
      statusMessage: response.statusMessage || '',

      // Raw header data (handle array values by taking first element)
      server: Array.isArray(headers.server) ? headers.server[0] : headers.server || null,
      contentType: Array.isArray(headers['content-type'])
        ? headers['content-type'][0]
        : headers['content-type'] || null,
      poweredBy: Array.isArray(headers['x-powered-by'])
        ? headers['x-powered-by'][0]
        : headers['x-powered-by'] || null,
      aspnetVersion: Array.isArray(headers['x-aspnet-version'])
        ? headers['x-aspnet-version'][0]
        : headers['x-aspnet-version'] || null,
      generator: Array.isArray(headers['x-generator'])
        ? headers['x-generator'][0]
        : headers['x-generator'] || null,

      // All headers (for reference)
      headers: Object.fromEntries(
        Object.entries(headers).filter(([_, value]) => value !== undefined),
      ) as Record<string, string | string[]>,

      // Raw body content
      body,
    };
  }

  /**
   * Parse SSL certificate information
   * @param {PeerCertificate} cert - Certificate object
   * @returns {SSLInfo} Parsed certificate info
   */
  parseCertificate(cert: PeerCertificate): SSLInfo {
    return {
      subject: (cert.subject || {}) as CertificateSubject,
      issuer: (cert.issuer || {}) as CertificateSubject,
      valid_from: cert.valid_from || null,
      valid_to: cert.valid_to || null,
      fingerprint: cert.fingerprint || null,
      serialNumber: cert.serialNumber || null,
      subjectaltname: cert.subjectaltname || null,
    };
  }
}

export default HTTPDiscovery;
