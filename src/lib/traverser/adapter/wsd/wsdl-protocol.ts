/**
 * WS-Discovery Protocol Module
 * Handles WS-Discovery probe messages and device discovery
 */

import * as dgram from 'dgram';

import type { ProbeMatchInfo } from './types';
import { extractScopeInfo } from './wsdl-scope-parser';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { v4: uuidv4 } = require('uuid');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const xml2js = require('xml2js');

/**
 * Create WS-Discovery probe message template
 */
function createProbeMessage(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap-env:Envelope xmlns:soap-env="http://www.w3.org/2003/05/soap-envelope" 
                   xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing" 
                   xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
                   xmlns:dn="http://www.onvif.org/ver10/network/wsdl"
                   xmlns:wsdp="http://schemas.xmlsoap.org/ws/2006/02/devprof"
                   xmlns:wscn="http://schemas.microsoft.com/windows/2006/08/wdp/scan"
                   xmlns:soap-enc="http://www.w3.org/2003/05/soap-encoding">
  <soap-env:Header>
    <a:Action mustUnderstand="1">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</a:Action>
    <a:MessageID>uuid:{UUID}</a:MessageID>
    <a:ReplyTo>
      <a:Address>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</a:Address>
    </a:ReplyTo>
    <a:To mustUnderstand="1">urn:schemas-xmlsoap-org:ws:2005:04:discovery</a:To>
  </soap-env:Header>
  <soap-env:Body>
    <d:Probe>
      <d:Types></d:Types>
    </d:Probe>
  </soap-env:Body>
</soap-env:Envelope>`;
}

/**
 * Parse WS-Discovery Probe response (handles multiple namespace formats)
 */
async function parseProbeResponse(responseXml: string): Promise<ProbeMatchInfo | null> {
  try {
    // Parse without namespace prefixes for easier access
    const cleanParser = new xml2js.Parser({
      explicitArray: false,
      tagNameProcessors: [xml2js.processors.stripPrefix],
      trim: true,
    });

    const cleanParsed = await cleanParser.parseStringPromise(responseXml);

    // Handle multiple envelope formats (soap:, soap-env:, env:, s:)
    const envelope = cleanParsed.Envelope;

    if (!envelope || !envelope.Body) {
      return null;
    }

    // Check for SOAP fault
    if (envelope.Body.Fault) {
      console.error('SOAP Fault received:', envelope.Body.Fault);

      return null;
    }

    // Look for ProbeMatches (handle both discovery namespaces)
    const probeMatches = envelope.Body.ProbeMatches;

    if (!probeMatches || !probeMatches.ProbeMatch) {
      return null;
    }

    // Handle single or multiple ProbeMatch elements
    const probeMatch = Array.isArray(probeMatches.ProbeMatch)
      ? probeMatches.ProbeMatch[0]
      : probeMatches.ProbeMatch;

    // Extract endpoint information (handle space-separated multiple endpoints)
    const xAddrs = probeMatch.XAddrs || '';
    const endpoint = xAddrs.split(/\s+/).find((e: string) => e.trim());

    if (!endpoint) {
      return null;
    }

    // Extract UUID from EndpointReference
    const endpointRef = probeMatch.EndpointReference;
    const address = endpointRef?.Address || '';
    const uuid = address.includes('uuid:') ? address.split('uuid:')[1] : address.split(':').pop();

    // Extract scopes (manufacturer, model, etc.)
    const scopes = probeMatch.Scopes;
    const scopeInfo = extractScopeInfo(scopes);

    // Extract types - handle both space-separated and direct text
    let typesStr = probeMatch.Types || '';

    if (typeof typesStr === 'object' && typesStr._) {
      typesStr = typesStr._;
    }

    const typesList = typesStr.split(/\s+/).filter((t: string) => t.trim());

    // Determine device category from types
    let deviceCategory = 'unknown';
    let deviceType: string | null = null;

    if (
      typesList.some(
        (t) =>
          t.toLowerCase().includes('networkvideotransmitter') || t.toLowerCase().includes('onvif'),
      )
    ) {
      deviceCategory = 'camera';
      deviceType = 'onvif_camera';
    } else if (
      typesList.some(
        (t) => t.toLowerCase().includes('printdevice') || t.toLowerCase().includes('print'),
      )
    ) {
      deviceCategory = 'printer';
      deviceType = 'wsd_printer';
    } else if (
      typesList.some(
        (t) => t.toLowerCase().includes('scandevice') || t.toLowerCase().includes('scan'),
      )
    ) {
      deviceCategory = 'scanner';
      deviceType = 'wsd_scanner';
    } else if (typesList.some((t) => t.toLowerCase().includes('mfp'))) {
      // Multi-function printer
      deviceCategory = 'printer';
      deviceType = 'wsd_mfp';
    }

    return {
      endpoint,
      uuid,
      types: typesList,
      deviceCategory,
      deviceType,
      manufacturer: scopeInfo.manufacturer || undefined,
      model: scopeInfo.model || undefined,
      macAddress: scopeInfo.macAddress || undefined,
      location: scopeInfo.location || undefined,
      scopeInfo,
    };
  } catch {
    return null;
  }
}

/**
 * Send WS-Discovery probe and wait for response
 */
export async function discoverDevice(
  ip: string,
  port: number,
  timeout: number,
): Promise<ProbeMatchInfo | null> {
  return new Promise<ProbeMatchInfo | null>((resolve) => {
    const socket = dgram.createSocket('udp4');
    let deviceInfo: ProbeMatchInfo | null = null;

    const timeoutHandle = setTimeout(() => {
      socket.close();
      resolve(deviceInfo);
    }, timeout);

    socket.on('error', (err) => {
      clearTimeout(timeoutHandle);
      socket.close();
      resolve(null);
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    socket.on('message', async (msg, rinfo) => {
      if (rinfo.address === ip) {
        try {
          const parsed = await parseProbeResponse(msg.toString());

          if (parsed && !deviceInfo) {
            deviceInfo = parsed;
            clearTimeout(timeoutHandle);
            socket.close();
            resolve(deviceInfo);
          }
        } catch {
          // Continue waiting for valid response
        }
      }
    });

    socket.on('listening', () => {
      const messageId = uuidv4();
      const probeTemplate = createProbeMessage();
      const message = probeTemplate.replace('{UUID}', messageId);
      const buffer = Buffer.from(message, 'utf8');

      // Send probe
      socket.send(buffer, port, ip, (err) => {
        if (err) {
          clearTimeout(timeoutHandle);
          socket.close();
          resolve(null);
        }
      });
    });

    socket.bind();
  });
}
