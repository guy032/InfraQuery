import dgram from 'dgram';

import type { SipDeviceInfo, SipResponse } from './types';

/**
 * SIP Device Discovery
 * Uses SIP OPTIONS request to discover VoIP devices and identify User-Agent
 */
export class SipDeviceDiscovery {
  private ip: string;

  private port: number;

  constructor(ip: string, port = 5060) {
    this.ip = ip;
    this.port = port;
  }

  /**
   * Build SIP OPTIONS request
   */
  buildSipOptionsRequest(): string {
    const branch = `z9hG4bK-${Math.floor(Math.random() * 10_000_000)}`;
    const tag = Math.floor(Math.random() * 10_000_000);
    const callId = Math.floor(Math.random() * 100_000);

    return [
      'OPTIONS sip:nm2@nm2 SIP/2.0',
      `Via: SIP/2.0/UDP nm;branch=${branch}`,
      `From: <sip:nm@nm>;tag=${tag}`,
      'To: <sip:nm2@nm2>',
      `Call-ID: ${callId}`,
      'CSeq: 42 OPTIONS',
      'Max-Forwards: 70',
      'Accept: application/sdp',
      'User-Agent: SIPScan',
      'Contact: <sip:scanner@localhost>',
      'Content-Length: 0',
      '',
      '',
    ].join('\r\n');
  }

  /**
   * Parse SIP response to extract device information
   */
  parseSipResponse(response: string): SipResponse {
    const lines = response.split('\r\n');
    const [statusLine, ...headerLines] = lines;

    // Parse status line
    const statusMatch = statusLine.match(/^SIP\/(\d+\.\d+)\s+(\d+)\s+(.+)$/);
    const statusCode = statusMatch ? Number.parseInt(statusMatch[2], 10) : null;
    const statusText = statusMatch ? statusMatch[3] : null;

    // Parse headers with special attention to device-identifying headers
    const headers: Record<string, string> = {};
    const deviceInfo: SipDeviceInfo = {
      userAgent: null,
      server: null,
      allow: null,
      supported: null,
      statusCode,
      statusText,
    };

    for (const line of headerLines) {
      if (!line) {
        continue;
      } // Skip empty lines

      const colonIndex = line.indexOf(': ');

      if (colonIndex === -1) {
        continue;
      }

      const key = line.slice(0, Math.max(0, colonIndex));
      const value = line.slice(Math.max(0, colonIndex + 2));

      if (key && value) {
        headers[key] = value;

        // Extract specific device information
        const keyLower = key.toLowerCase();

        switch (keyLower) {
          case 'user-agent': {
            deviceInfo.userAgent = value;
            break;
          }

          case 'server': {
            deviceInfo.server = value;
            break;
          }

          case 'allow': {
            deviceInfo.allow = value;
            break;
          }

          case 'supported': {
            deviceInfo.supported = value;
            break;
          }
        }
      }
    }

    return {
      deviceInfo,
      headers,
      statusLine,
    };
  }

  /**
   * Discover SIP device
   */
  async discover(timeout = 1000): Promise<SipResponse> {
    // TURBO MODE: 1 second timeout (reduced from 5s)
    return new Promise<SipResponse>((resolve, reject) => {
      const client = dgram.createSocket('udp4');
      const sipRequest = this.buildSipOptionsRequest();

      // Set timeout to clean up if no response is received
      const timeoutHandle = setTimeout(() => {
        client.close();
        reject(new Error('SIP scan timeout'));
      }, timeout);

      client.on('message', (msg, rinfo) => {
        const rawResponse = msg.toString();
        const parsedResponse = this.parseSipResponse(rawResponse);
        clearTimeout(timeoutHandle);
        client.close();
        resolve(parsedResponse);
      });

      client.on('error', (err) => {
        clearTimeout(timeoutHandle);
        client.close();
        reject(err);
      });

      client.on('listening', () => {
        client.send(sipRequest, this.port, this.ip, (err) => {
          if (err) {
            clearTimeout(timeoutHandle);
            client.close();
            reject(err);
          }
        });
      });

      // Bind to a random port to receive responses
      client.bind();
    });
  }

  /**
   * Get device identification
   */
  async getDeviceInfo(): Promise<SipDeviceInfo | null> {
    try {
      const result = await this.discover();

      // Return null if no device info was found
      if (!result.deviceInfo.userAgent && !result.deviceInfo.server) {
        return null;
      }

      // Build comprehensive device info
      const deviceInfo: SipDeviceInfo = {};

      if (result.deviceInfo.userAgent) {
        deviceInfo.userAgent = result.deviceInfo.userAgent;

        // Try to parse vendor/model from User-Agent
        // Common formats: "Yealink W60B 77.83.0.85", "Avaya Nebraska Contact Center 7.0.0.0"
        const parts = result.deviceInfo.userAgent.split(' ');

        if (parts.length > 0) {
          deviceInfo.vendor = parts[0];

          if (parts.length >= 2) {
            deviceInfo.model = parts.slice(1, -1).join(' ') || parts[1];
            deviceInfo.version = parts.at(-1);
          }
        }
      }

      if (result.deviceInfo.server) {
        deviceInfo.server = result.deviceInfo.server;
      }

      if (result.deviceInfo.allow) {
        deviceInfo.allow = result.deviceInfo.allow;
      }

      if (result.deviceInfo.supported) {
        deviceInfo.supported = result.deviceInfo.supported;
      }

      if (result.deviceInfo.statusCode) {
        deviceInfo.statusCode = result.deviceInfo.statusCode;
      }

      return Object.keys(deviceInfo).length > 0 ? deviceInfo : null;
    } catch {
      return null;
    }
  }
}
