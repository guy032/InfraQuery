/**
 * TypeScript type definitions for HTTP protocol
 */

/**
 * Certificate subject information
 */
export interface CertificateSubject {
  C?: string;
  ST?: string;
  L?: string;
  O?: string;
  OU?: string;
  CN?: string;
  [key: string]: string | undefined;
}

/**
 * SSL/TLS certificate information
 */
export interface SSLInfo {
  subject: CertificateSubject;
  issuer: CertificateSubject;
  valid_from: string | null;
  valid_to: string | null;
  fingerprint: string | null;
  serialNumber: string | null;
  subjectaltname: string | null;
}

/**
 * HTTP device information
 */
export interface HTTPDeviceInfo {
  type: string;
  httpEnabled: boolean;
  httpPort: number;
  httpProtocol: string;
  statusCode: number;
  statusMessage: string;
  server: string | null;
  contentType: string | null;
  poweredBy: string | null;
  aspnetVersion: string | null;
  generator: string | null;
  headers: Record<string, string | string[]>;
  body: string;
  ssl?: SSLInfo;
}

/**
 * HTTP discovery options
 */
export interface HTTPDiscoveryOptions {
  timeout?: number;
}
