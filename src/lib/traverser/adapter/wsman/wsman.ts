/**
 * WinRM Protocol Implementation
 *
 * Provides WinRM service detection and Windows device identification
 * Identifies Windows computers via WinRM/NTLM authentication headers
 *
 * Features:
 * - WinRM service detection (HTTP/HTTPS ports 5985/5986)
 * - Windows OS version detection from NTLM challenge
 * - Computer name and domain extraction
 * - FQDN and NetBIOS name resolution
 */

import { EventEmitter } from 'events';
import * as http from 'http';
import * as https from 'https';

import type { WinRMDeviceInfo } from './types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ntlmParse } = require('ntlm-parser');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const windowsRelease = require('windows-release');

export class WinRMDiscovery extends EventEmitter {
  private ip: string;

  private port: number;

  private useHTTPS: boolean;

  public WINRM_TIMEOUT: number;

  constructor(ip: string, port = 5985) {
    super();
    this.ip = ip;
    this.port = port;
    this.WINRM_TIMEOUT = 1000; // TURBO MODE: 1 second timeout (reduced from 5s)
    this.useHTTPS = port === 5986;
  }

  /**
   * Discover WinRM service on the target host
   * @returns {Promise<Object>} WinRM device information
   */
  async discover(): Promise<WinRMDeviceInfo> {
    return new Promise<WinRMDeviceInfo>((resolve, reject) => {
      const protocol = this.useHTTPS ? https : http;

      const options: http.RequestOptions & https.RequestOptions = {
        hostname: this.ip,
        port: this.port,
        path: '/wsman',
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml;charset=UTF-8',
          'User-Agent': 'NetworkScanner/1.0',
          Authorization: 'Negotiate TlRMTVNTUAABAAAAB4IIogAAAAAAAAAAAAAAAAAAAAAGAbEdAAAADw==', // eslint-disable-line quote-props
        },
        timeout: this.WINRM_TIMEOUT,
        rejectUnauthorized: false, // Allow self-signed certificates
      };

      const req = protocol.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const deviceInfo = this.parseWinRMResponse(res.headers, data);
            resolve(deviceInfo);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('WinRM request timeout'));
      });

      req.end();
    });
  }

  /**
   * Parse WinRM response to extract device information
   * @param {Object} headers - HTTP response headers
   * @param {string} body - Response body
   * @returns {Object} Parsed device information
   */
  parseWinRMResponse(headers: http.IncomingHttpHeaders, _body: string): WinRMDeviceInfo {
    const deviceInfo: WinRMDeviceInfo = {
      type: 'computer',
      os: 'Windows',
      osVersion: null,
      osBuild: null,
      hostname: null,
      netbiosComputerName: null,
      netbiosDomainName: null,
      fqdn: null,
      dnsDomainName: null,
      dnsTreeName: null,
      vendor: 'Microsoft',
      description: 'Windows Computer',
      winrmEnabled: true,
      winrmPort: this.port,
      winrmProtocol: this.useHTTPS ? 'https' : 'http',
    };

    // Check for WinRM/Windows indicators
    const wwwAuthenticate = headers['www-authenticate'] || headers['WWW-Authenticate'];

    if (!wwwAuthenticate) {
      // Even without NTLM, if we got a response from /wsman, it's likely WinRM
      return deviceInfo;
    }

    // Parse NTLM challenge if available
    const ntlmMatch =
      typeof wwwAuthenticate === 'string'
        ? wwwAuthenticate.match(/Negotiate ([\d+/=A-Za-z]+)/)
        : null;

    if (ntlmMatch) {
      this.parseNTLMChallenge(ntlmMatch[1], deviceInfo);
    }

    // Build description
    if (deviceInfo.osVersion) {
      deviceInfo.description = `Windows ${deviceInfo.osVersion}`;

      if (deviceInfo.osBuild) {
        deviceInfo.description += ` (Build ${deviceInfo.osBuild})`;
      }
    }

    // Set hostname priority: FQDN > NetBIOS > IP
    if (!deviceInfo.hostname) {
      deviceInfo.hostname = deviceInfo.fqdn || deviceInfo.netbiosComputerName || this.ip;
    }

    return deviceInfo;
  }

  /**
   * Parse NTLM challenge message (Type 2) using ntlm-parser
   * @param {string} ntlmBase64 - Base64 encoded NTLM message
   * @param {Object} deviceInfo - Device info object to populate
   */
  parseNTLMChallenge(ntlmBase64: string, deviceInfo: WinRMDeviceInfo): void {
    try {
      // Parse the NTLM challenge message using ntlm-parser
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const parsedNTLM = ntlmParse(ntlmBase64);

      // Extract OS version information from osVersionStructure
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (parsedNTLM.osVersionStructure) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const { majorVersion, minorVersion, buildNumber } = parsedNTLM.osVersionStructure;
        const versionString = `${majorVersion}.${minorVersion}.${buildNumber}`;

        // Use windows-release to get the Windows version name
        let windowsVersion;

        try {
          // windows-release.default is the actual function when using require()
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
          windowsVersion = windowsRelease.default
            ? windowsRelease.default(versionString)
            : windowsRelease(versionString);

          if (!windowsVersion) {
            // Fallback if windows-release doesn't recognize the version
            windowsVersion = `Windows NT ${versionString}`;
          }
        } catch {
          windowsVersion = `Windows NT ${versionString}`;
        }

        deviceInfo.osBuild = buildNumber?.toString() || '';
        deviceInfo.osVersion = windowsVersion;
        deviceInfo.osVersionNumber = versionString;
      }

      // Extract hostname from targetNameData (this is the computer name)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (parsedNTLM.targetNameData) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const hostname = parsedNTLM.targetNameData as string;
        deviceInfo.hostname = hostname;
        deviceInfo.netbiosComputerName = hostname;
      }

      // Extract target name (this might be domain/workgroup name in some cases)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (
        parsedNTLM.targetName && // Only set as domain if it's different from the computer name
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        parsedNTLM.targetName !== parsedNTLM.targetNameData
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        deviceInfo.netbiosDomainName = parsedNTLM.targetName as string;
      }

      // Extract target info fields from targetInfoData array
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (parsedNTLM.targetInfoData && Array.isArray(parsedNTLM.targetInfoData)) {
        // The targetInfoData is an array of objects with type and content
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        for (const item of parsedNTLM.targetInfoData) {
          if (!item || !item.type) {
            continue;
          }

          switch (item.type) {
            case 1: {
              // NetBIOS computer name
              if (item.content && !deviceInfo.netbiosComputerName) {
                deviceInfo.netbiosComputerName = item.content;
              }

              break;
            }

            case 2: {
              // NetBIOS domain name
              if (item.content && !deviceInfo.netbiosDomainName) {
                deviceInfo.netbiosDomainName = item.content;
              }

              break;
            }

            case 3: {
              // DNS computer name (FQDN)
              if (item.content && !deviceInfo.fqdn) {
                deviceInfo.fqdn = item.content;
              }

              break;
            }

            case 4: {
              // DNS domain name
              if (item.content && !deviceInfo.dnsDomainName) {
                deviceInfo.dnsDomainName = item.content;
              }

              break;
            }

            case 5: {
              // DNS tree name
              if (item.content && !deviceInfo.dnsTreeName) {
                deviceInfo.dnsTreeName = item.content;
              }

              break;
            }
          }
        }
      }
    } catch {
      // Silent fail - NTLM parsing is optional
    }
  }
}
