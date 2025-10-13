/**
 * SSH Protocol Implementation
 *
 * Provides SSH banner detection and device identification
 * Identifies SSH-enabled devices and extracts system information from SSH banners
 *
 * Features:
 * - SSH service detection via banner exchange
 * - SSH version identification (OpenSSH, Dropbear, libssh, etc.)
 * - OS detection from SSH banner (Ubuntu, Debian, CentOS, etc.)
 * - SSH software version extraction
 */

import { EventEmitter } from 'events';
import * as net from 'net';

import type { SSHDeviceInfo } from './types';

export class SSHDiscovery extends EventEmitter {
  private ip: string;

  private port: number;

  public SSH_TIMEOUT: number;

  constructor(ip: string, port = 22) {
    super();
    this.ip = ip;
    this.port = port;
    this.SSH_TIMEOUT = 1000; // TURBO MODE: 1 second timeout (reduced from 5s)
  }

  /**
   * Discover SSH service on the target host
   * @returns {Promise<Object>} SSH device information
   */
  async discover(): Promise<SSHDeviceInfo> {
    return new Promise<SSHDeviceInfo>((resolve, reject) => {
      const socket = new net.Socket();
      let banner = '';
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        socket.destroy();
        reject(new Error('SSH connection timeout'));
      }, this.SSH_TIMEOUT);

      socket.on('data', (data) => {
        banner += data.toString();

        // SSH banner ends with \r\n
        if (banner.includes('\r\n')) {
          clearTimeout(timeout);
          socket.destroy();

          const deviceInfo = this.parseSSHBanner(banner.trim());
          resolve(deviceInfo);
        }
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);

        if (!timedOut) {
          reject(err);
        }
      });

      socket.on('timeout', () => {
        clearTimeout(timeout);
        socket.destroy();
        reject(new Error('SSH socket timeout'));
      });

      // Connect to SSH port
      socket.connect(this.port, this.ip, () => {
        // Send SSH client identification string
        // This triggers the server to send its banner
        socket.write('SSH-2.0-NetworkScanner_1.0\r\n');
      });

      socket.setTimeout(this.SSH_TIMEOUT);
    });
  }

  /**
   * Parse SSH banner to extract device information
   * @param {string} banner - SSH banner string
   * @returns {Object} Parsed device information
   */
  parseSSHBanner(banner: string): SSHDeviceInfo {
    const deviceInfo: SSHDeviceInfo = {
      banner,
      protocol: null,
      software: null,
      version: null,
      os: null,
      osVersion: null,
      osDistribution: null,
      vendor: null,
      description: null,
      type: 'computer',
    };

    // SSH banner format: SSH-<protocol>-<software>_<version> <comments>
    const sshMatch = banner.match(/SSH-(\d+\.\d+)-(.+)/);

    if (!sshMatch) {
      return deviceInfo;
    }

    deviceInfo.protocol = sshMatch[1];
    const fullSoftwareString = sshMatch[2].trim();

    // Extract software version (first non-space token)
    const softwareMatch = fullSoftwareString.match(/^(\S+)/);

    if (softwareMatch) {
      deviceInfo.software = softwareMatch[1];
    }

    // Parse OpenSSH
    if (fullSoftwareString.toLowerCase().includes('openssh')) {
      const versionMatch = fullSoftwareString.match(/openssh[\s_]?([\d.]+[a-z]?\d*)/i);

      if (versionMatch) {
        deviceInfo.software = 'OpenSSH';
        deviceInfo.version = versionMatch[1];
      }

      // Extract OS information from OpenSSH banner
      // Examples:
      // OpenSSH_8.9p1 Ubuntu-3ubuntu0.1
      // OpenSSH_7.4p1 Debian-10+deb9u7
      // OpenSSH_8.2p1 Ubuntu-4ubuntu0.5
      this.parseOSInfo(fullSoftwareString, deviceInfo);
    }
    // Parse Dropbear
    else if (fullSoftwareString.toLowerCase().includes('dropbear')) {
      const versionMatch = fullSoftwareString.match(/dropbear[\s_]?([\d.]+)/i);

      if (versionMatch) {
        deviceInfo.software = 'Dropbear';
        deviceInfo.version = versionMatch[1];
      }

      this.parseOSInfo(fullSoftwareString, deviceInfo);
    }
    // Parse libssh
    else if (fullSoftwareString.toLowerCase().includes('libssh')) {
      const versionMatch = fullSoftwareString.match(/libssh[\s_]?([\d.]+)/i);

      if (versionMatch) {
        deviceInfo.software = 'libssh';
        deviceInfo.version = versionMatch[1];
      }

      this.parseOSInfo(fullSoftwareString, deviceInfo);
    }

    // Set vendor based on OS distribution
    if (deviceInfo.osDistribution) {
      deviceInfo.vendor = this.getVendorFromOS(deviceInfo.osDistribution);

      // Build description
      deviceInfo.description = deviceInfo.osVersion
        ? `${deviceInfo.osDistribution} ${deviceInfo.osVersion}`
        : deviceInfo.osDistribution;
    } else if (deviceInfo.software && deviceInfo.version) {
      deviceInfo.vendor = 'Linux';
      deviceInfo.description = `${deviceInfo.software} ${deviceInfo.version}`;
    }

    return deviceInfo;
  }

  /**
   * Parse OS information from SSH banner
   * @param {string} bannerString - SSH banner string
   * @param {Object} deviceInfo - Device info object to populate
   */
  parseOSInfo(bannerString: string, deviceInfo: SSHDeviceInfo): void {
    // Check for Ubuntu
    const ubuntuMatch = bannerString.match(/ubuntu[\s-]?(\S*)/i);

    if (ubuntuMatch) {
      deviceInfo.osDistribution = 'Ubuntu';
      deviceInfo.os = 'Ubuntu';

      if (ubuntuMatch[1]) {
        deviceInfo.osVersion = this.beautifyOSVersion('Ubuntu', ubuntuMatch[1]);
      }

      return;
    }

    // Check for Debian
    const debianMatch = bannerString.match(/debian[\s-]?(\S*)/i);

    if (debianMatch) {
      deviceInfo.osDistribution = 'Debian';
      deviceInfo.os = 'Debian';

      if (debianMatch[1]) {
        deviceInfo.osVersion = this.beautifyOSVersion('Debian', debianMatch[1]);
      }

      return;
    }

    // Check for CentOS
    const centosMatch = bannerString.match(/centos[\s-]?(\S*)/i);

    if (centosMatch) {
      deviceInfo.osDistribution = 'CentOS';
      deviceInfo.os = 'CentOS';

      if (centosMatch[1]) {
        deviceInfo.osVersion = centosMatch[1];
      }

      return;
    }

    // Check for RHEL/Red Hat
    const rhelMatch = bannerString.match(/(?:rhel|red[\s-]?hat)[\s-]?(\S*)/i);

    if (rhelMatch) {
      deviceInfo.osDistribution = 'Red Hat Enterprise Linux';
      deviceInfo.os = 'RHEL';

      if (rhelMatch[1]) {
        deviceInfo.osVersion = rhelMatch[1];
      }

      return;
    }

    // Check for Fedora
    const fedoraMatch = bannerString.match(/fedora[\s-]?(\S*)/i);

    if (fedoraMatch) {
      deviceInfo.osDistribution = 'Fedora';
      deviceInfo.os = 'Fedora';

      if (fedoraMatch[1]) {
        deviceInfo.osVersion = fedoraMatch[1];
      }

      return;
    }

    // Check for SUSE
    const suseMatch = bannerString.match(/suse[\s-]?(\S*)/i);

    if (suseMatch) {
      deviceInfo.osDistribution = 'SUSE Linux';
      deviceInfo.os = 'SUSE';

      if (suseMatch[1]) {
        deviceInfo.osVersion = suseMatch[1];
      }

      return;
    }

    // Check for Raspbian
    const raspbianMatch = bannerString.match(/raspbian[\s-]?(\S*)/i);

    if (raspbianMatch) {
      deviceInfo.osDistribution = 'Raspbian';
      deviceInfo.os = 'Raspbian';

      if (raspbianMatch[1]) {
        deviceInfo.osVersion = raspbianMatch[1];
      }

      return;
    }

    // Check for Alpine
    const alpineMatch = bannerString.match(/alpine[\s-]?(\S*)/i);

    if (alpineMatch) {
      deviceInfo.osDistribution = 'Alpine Linux';
      deviceInfo.os = 'Alpine';

      if (alpineMatch[1]) {
        deviceInfo.osVersion = alpineMatch[1];
      }

      return;
    }

    // Check for Arch
    const archMatch = bannerString.match(/arch[\s-]?(\S*)/i);

    if (archMatch) {
      deviceInfo.osDistribution = 'Arch Linux';
      deviceInfo.os = 'Arch';

      if (archMatch[1]) {
        deviceInfo.osVersion = archMatch[1];
      }

      return;
    }

    // Default to Linux if no specific distribution found
    deviceInfo.os = 'Linux';
  }

  /**
   * Beautify OS version string
   * @param {string} distribution - OS distribution name
   * @param {string} rawVersion - Raw version string
   * @returns {string} Beautified version string
   */
  beautifyOSVersion(distribution: string, rawVersion: string): string {
    const version = rawVersion.startsWith('-') ? rawVersion.slice(1) : rawVersion;

    if (distribution === 'Ubuntu') {
      // Ubuntu version patterns:
      // -4ubuntu0.13 -> (4ubuntu0.13)
      if (version) {
        return `(${version})`;
      }

      return '';
    }

    if (distribution === 'Debian') {
      // Debian version patterns:
      // -5+deb11u5 -> Debian 11 (Bullseye)
      const debMatch = version.match(/deb(\d+)/i);

      if (debMatch) {
        const debianVersion = debMatch[1];
        const updateMatch = version.match(/u(\d+)/);
        const updateNum = updateMatch ? updateMatch[1] : '';

        const debianCodenames: Record<string, string> = {
          9: 'Stretch',
          10: 'Buster',
          11: 'Bullseye',
          12: 'Bookworm',
          13: 'Trixie',
        };

        const codename = debianCodenames[debianVersion] || '';

        if (codename) {
          return updateNum
            ? `${debianVersion} ${codename} (u${updateNum})`
            : `${debianVersion} ${codename}`;
        }

        return updateNum ? `${debianVersion} (u${updateNum})` : debianVersion;
      }

      return version;
    }

    return version;
  }

  /**
   * Get vendor name from OS distribution
   * @param {string} distribution - OS distribution
   * @returns {string} Vendor name
   */
  getVendorFromOS(distribution: string): string {
    const vendors: Record<string, string> = {
      Ubuntu: 'Canonical',
      Debian: 'Debian',
      CentOS: 'CentOS',
      ['Red Hat Enterprise Linux']: 'Red Hat',
      Fedora: 'Fedora Project',
      ['SUSE Linux']: 'SUSE',
      Raspbian: 'Raspberry Pi Foundation',
      ['Alpine Linux']: 'Alpine',
      ['Arch Linux']: 'Arch',
    };

    return vendors[distribution] || 'Linux';
  }
}
