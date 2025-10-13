/**
 * DNS Query Protocol Implementation
 *
 * Native implementation of DNS query for hostname resolution and DNS server testing.
 * Uses Node.js dns module for DNS lookups.
 *
 * Features:
 * - DNS server availability detection
 * - Query response time measurement
 * - Support for multiple record types (A, AAAA, MX, TXT, etc.)
 * - DNS resolution testing
 */

import * as dns from 'dns';
import { promisify } from 'util';

import type { DnsQueryOptions, DnsQueryResult } from './types';

const resolve = promisify(dns.resolve);
const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);
const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);
const resolveCname = promisify(dns.resolveCname);
const resolveNs = promisify(dns.resolveNs);
const resolveSrv = promisify(dns.resolveSrv);
const resolvePtr = promisify(dns.resolvePtr);

export class DnsQueryDiscovery {
  private server: string;

  private port: number;

  private options: Required<DnsQueryOptions>;

  constructor(server: string, port = 53, options: DnsQueryOptions = {}) {
    this.server = server;
    this.port = port;
    
    // Default to reverse DNS lookup of the target server itself
    const defaultDomains = [this.getReverseDnsName(server)];
    
    this.options = {
      domains: options.domains || defaultDomains,
      recordType: options.recordType || 'PTR',
      timeout: options.timeout || 2000,
      network: options.network || 'udp',
    };
  }
  
  /**
   * Convert IP address to reverse DNS name (in-addr.arpa format)
   */
  private getReverseDnsName(ip: string): string {
    const parts = ip.split('.');
    return `${parts[3]}.${parts[2]}.${parts[1]}.${parts[0]}.in-addr.arpa`;
  }

  /**
   * Query DNS server
   */
  async query(): Promise<DnsQueryResult[]> {
    const results: DnsQueryResult[] = [];

    // Configure DNS resolver to use this specific server
    const resolver = new dns.Resolver();
    resolver.setServers([`${this.server}:${this.port}`]);

    for (const domain of this.options.domains) {
      const result = await this.queryDomain(resolver, domain);
      results.push(result);
    }

    return results;
  }

  /**
   * Query a specific domain
   */
  private async queryDomain(resolver: dns.Resolver, domain: string): Promise<DnsQueryResult> {
    const startTime = Date.now();
    const recordType = this.options.recordType.toUpperCase();

    try {
      let answers: string[] = [];

      // Resolve based on record type
      switch (recordType) {
        case 'A': {
          answers = await promisify(resolver.resolve4.bind(resolver))(domain);
          break;
        }

        case 'AAAA': {
          answers = await promisify(resolver.resolve6.bind(resolver))(domain);
          break;
        }

        case 'MX': {
          const mxRecords = await promisify(resolver.resolveMx.bind(resolver))(domain);
          answers = mxRecords.map((mx) => `${mx.priority} ${mx.exchange}`);
          break;
        }

        case 'TXT': {
          const txtRecords = await promisify(resolver.resolveTxt.bind(resolver))(domain);
          answers = txtRecords.map((txt) => txt.join(' '));
          break;
        }

        case 'CNAME': {
          answers = await promisify(resolver.resolveCname.bind(resolver))(domain);
          break;
        }

        case 'NS': {
          answers = await promisify(resolver.resolveNs.bind(resolver))(domain);
          break;
        }

        case 'PTR': {
          answers = await promisify(resolver.resolvePtr.bind(resolver))(domain);
          break;
        }

        case 'SRV': {
          const srvRecords = await promisify(resolver.resolveSrv.bind(resolver))(domain);
          answers = srvRecords.map(
            (srv) => `${srv.priority} ${srv.weight} ${srv.port} ${srv.name}`,
          );
          break;
        }

        default: {
          // Fallback to generic resolve
          answers = (await promisify(resolver.resolve.bind(resolver))(
            domain,
            recordType,
          )) as string[];
        }
      }

      const queryTimeMs = Date.now() - startTime;

      return {
        domain,
        server: this.server,
        recordType,
        queryTimeMs,
        resultCode: 'NOERROR',
        rcodeValue: 0,
        answers,
      };
    } catch (error: unknown) {
      const queryTimeMs = Date.now() - startTime;
      const err = error as NodeJS.ErrnoException;

      // Map error codes to DNS result codes
      let resultCode = 'SERVFAIL';
      let rcodeValue = 2;

      switch (err.code) {
        case 'ENOTFOUND':

        case 'ENODATA': {
          resultCode = 'NXDOMAIN';
          rcodeValue = 3;

          break;
        }

        case 'ETIMEOUT':

        case 'ETIMEDOUT': {
          resultCode = 'TIMEOUT';
          rcodeValue = 2;

          break;
        }

        case 'EREFUSED':

        case 'ECONNREFUSED': {
          resultCode = 'REFUSED';
          rcodeValue = 5;

          break;
        }

        case 'EFORMERR': {
          resultCode = 'FORMERR';
          rcodeValue = 1;

          break;
        }
        // No default
      }

      return {
        domain,
        server: this.server,
        recordType,
        queryTimeMs,
        resultCode,
        rcodeValue,
        answers: [],
        error: err.message,
      };
    }
  }

  /**
   * Test if server is a DNS server by querying it
   */
  async testDnsServer(): Promise<boolean> {
    try {
      const results = await this.query();

      // Consider successful if at least one query succeeded
      return results.some((result) => result.rcodeValue === 0);
    } catch {
      return false;
    }
  }
}
