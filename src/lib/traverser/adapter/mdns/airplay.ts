/**
 * AirPlay mDNS service parser and direct connection
 * Uses 'bplist-parser' package for binary plist parsing
 */

import bplist from 'bplist-parser';
import net from 'net';

import type { AirPlayInfo, AirPlayResult, AirPlayTxtData, ServiceConfig } from './types';

/**
 * AirPlay-specific data parsing from mDNS TXT records
 */
export function parseAirPlayServiceData(txtData: Record<string, string>): AirPlayTxtData {
  return {
    deviceid: txtData.deviceid || '',
    model: txtData.model || '',
    srcvers: txtData.srcvers || '', // Source version
    features: txtData.features || '',
    flags: txtData.flags || '',
    pi: txtData.pi || '', // MAC address
    vv: txtData.vv || '', // Volume
    am: txtData.am || '', // Audio model
    md: txtData.md || '', // Model
    cn: txtData.cn || '', // Computer name
    tp: txtData.tp || '', // Transport
  };
}

/**
 * Validates if an HTTP response is from a genuine AirPlay device
 */
function validateAirPlayResponse(responseStr: string): boolean {
  // Check for AirPlay-specific content types
  const contentTypeMatch = responseStr.match(/content-type:\s*([^\n\r]+)/i);

  if (contentTypeMatch) {
    const contentType = contentTypeMatch[1].toLowerCase();

    if (
      contentType.includes('apple-binary-plist') ||
      contentType.includes('apple-plist') ||
      contentType.includes('x-apple')
    ) {
      return true;
    }
  }

  // Check for AirPlay-specific response content
  const lowerResponse = responseStr.toLowerCase();
  const airplayIndicators = [
    'deviceid',
    'sourceversion',
    'protocolversion',
    'airplayversion',
    'audioformats',
    'statusflags',
    'volumecontroltype',
    'keepalivelowpower',
  ];

  let foundIndicators = 0;

  for (const indicator of airplayIndicators) {
    if (lowerResponse.includes(indicator)) {
      foundIndicators++;
    }
  }

  // Require at least 2 AirPlay-specific indicators
  return foundIndicators >= 2;
}

/**
 * Parse AirPlay response with full binary plist support
 */
function parseAirPlayResponse(responseData: Buffer, targetIp: string, port: number): AirPlayInfo {
  const responseStr = responseData.toString('utf8');

  // Initialize with all fields
  const airplayInfo: AirPlayInfo = {
    Name: '',
    Address: targetIp,
    Port: port,
    Server: '',
    DeviceModel: '',
    AirPlayVersion: '',
    DeviceId: '',
    MacAddress: '',
    ProtocolVersion: '',
    Features: '',
    SenderAddress: '',
    PublicKey: '',
    PSI: '',
    PairingIdentifier: '',
    Manufacturer: '',
    Integrator: '',
    SerialNumber: '',
    FirmwareRevision: '',
    FirmwareBuildDate: '',
    HardwareRevision: '',
    OperatingSystem: '',
    BuildVersion: '',
    OSBuildVersion: '',
    SDK: '',
    PTPInfo: '',
    StatusFlags: null,
    VolumeControlType: null,
    ActiveInterfaceType: null,
    NameIsFactoryDefault: null,
    KeepAliveLowPower: null,
    KeepAliveSendStatsAsBody: null,
    AudioLatencies: null,
    AudioFormats: null,
    SupportedAudioFormatsExtended: null,
    SupportedFormats: null,
    PlaybackCapabilities: null,
    Displays: null,
    ReceiverHDRCapability: '',
    CanRecordScreenStream: null,
    Volume: null,
    VolumeSupported: null,
    InitialVolume: null,
    ScreenDemoMode: null,
    FeaturesEx: '',
  };

  // Validate response
  if (!validateAirPlayResponse(responseStr)) {
    throw new Error('Not a valid AirPlay response');
  }

  // Extract Server header
  const serverMatch = responseStr.match(/server:\s*([^\n\r]+)/i);

  if (serverMatch) {
    airplayInfo.Server = serverMatch[1].trim();

    // Extract AirPlay version from server header
    const versionMatch = serverMatch[1].match(/AirTunes\/(\d+\.\d+\.\d+)/);

    if (versionMatch) {
      airplayInfo.AirPlayVersion = versionMatch[1];
    }
  }

  // Check for binary plist content
  const contentTypeMatch = responseStr.match(/content-type:\s*([^\n\r]+)/i);
  const isBinaryPlist = contentTypeMatch && contentTypeMatch[1].includes('apple-binary-plist');

  if (isBinaryPlist) {
    try {
      // Find the boundary between HTTP headers and binary data
      const headerEnd = responseData.indexOf(Buffer.from('\r\n\r\n')) + 4;
      const binaryContent = responseData.slice(headerEnd);

      // Parse the binary plist
      const plistData = bplist.parseBuffer(binaryContent)[0];

      if (plistData) {
        // Field mapping: plistData key -> airplayInfo key (with optional transform)
        const fieldMap: Array<[string, keyof AirPlayInfo, ((v: unknown) => unknown)?]> = [
          ['name', 'Name'],
          ['model', 'DeviceModel'],
          ['sourceVersion', 'AirPlayVersion'],
          ['deviceID', 'DeviceId'],
          ['pi', 'PairingIdentifier'],
          ['macAddress', 'MacAddress'],
          ['protocolVersion', 'ProtocolVersion'],
          ['features', 'Features', (v) => (v as any).toString()],
          ['senderAddress', 'SenderAddress'],
          ['pk', 'PublicKey'],
          ['psi', 'PSI'],
          ['manufacturer', 'Manufacturer'],
          ['integrator', 'Integrator'],
          ['serialNumber', 'SerialNumber'],
          ['firmwareRevision', 'FirmwareRevision'],
          ['firmwareBuildDate', 'FirmwareBuildDate'],
          ['hardwareRevision', 'HardwareRevision'],
          ['operatingSystem', 'OperatingSystem'],
          ['build', 'BuildVersion'],
          ['osBuildVersion', 'OSBuildVersion'],
          ['sdk', 'SDK'],
          ['PTPInfo', 'PTPInfo'],
          ['statusFlags', 'StatusFlags'],
          ['volumeControlType', 'VolumeControlType'],
          ['activeInterfaceType', 'ActiveInterfaceType'],
          ['nameIsFactoryDefault', 'NameIsFactoryDefault'],
          ['keepAliveLowPower', 'KeepAliveLowPower'],
          ['keepAliveSendStatsAsBody', 'KeepAliveSendStatsAsBody'],
          ['audioLatencies', 'AudioLatencies'],
          ['audioFormats', 'AudioFormats'],
          ['supportedAudioFormatsExtended', 'SupportedAudioFormatsExtended'],
          ['supportedFormats', 'SupportedFormats'],
          ['playbackCapabilities', 'PlaybackCapabilities'],
          ['displays', 'Displays'],
          ['receiverHDRCapability', 'ReceiverHDRCapability'],
          ['canRecordScreenStream', 'CanRecordScreenStream'],
          ['vv', 'Volume'],
          ['vs', 'VolumeSupported'],
          ['initialVolume', 'InitialVolume'],
          ['screenDemoMode', 'ScreenDemoMode'],
          ['featuresEx', 'FeaturesEx'],
        ];

        for (const [srcKey, destKey, transform] of fieldMap) {
          if (plistData[srcKey] !== undefined) {
            (airplayInfo as any)[destKey] = transform
              ? transform(plistData[srcKey])
              : plistData[srcKey];
          }
        }
      }
    } catch {
      // Continue with JSON fallback
    }
  }

  // Try JSON parsing as fallback
  const jsonMatch = responseStr.match(/{[\S\s]*}/);

  if (jsonMatch) {
    try {
      const jsonData = JSON.parse(jsonMatch[0]);
      const jsonMap: Array<[string, keyof AirPlayInfo]> = [
        ['name', 'Name'],
        ['model', 'DeviceModel'],
        ['sourceVersion', 'AirPlayVersion'],
        ['deviceID', 'DeviceId'],
        ['pi', 'MacAddress'],
        ['protocolVersion', 'ProtocolVersion'],
      ];

      for (const [srcKey, destKey] of jsonMap) {
        if (jsonData[srcKey] && !(airplayInfo as any)[destKey]) {
          (airplayInfo as any)[destKey] = jsonData[srcKey];
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  // Set default name if none found
  if (!airplayInfo.Name) {
    airplayInfo.Name = 'Unknown AirPlay Device';
  }

  return airplayInfo;
}

/**
 * Query AirPlay device on a specific port
 */
function queryAirPlayPort(targetIp: string, port: number): Promise<AirPlayResult> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(1000); // TURBO MODE: 1 second timeout (reduced from 5s)

    const httpRequest = `GET /info HTTP/1.1\r\nHost: ${targetIp}\r\nConnection: close\r\n\r\n`;

    socket.connect(port, targetIp, () => {
      socket.write(httpRequest);
    });

    let responseData = Buffer.alloc(0);

    socket.on('data', (chunk: Buffer) => {
      responseData = Buffer.concat([responseData, chunk]);
    });

    socket.on('end', () => {
      try {
        const airplayInfo = parseAirPlayResponse(responseData, targetIp, port);
        resolve({
          airplay: {
            services: {
              [`${port}/tcp airplay`]: airplayInfo,
            },
          },
          serviceType: 'airplay',
        });
      } catch (error) {
        reject(error);
      }
    });

    socket.on('error', (error: Error) => {
      reject(error);
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`AirPlay request timeout on port ${port}`));
    });
  });
}

/**
 * Try to connect to AirPlay on both common ports
 */
export async function queryAirPlayDirect(targetIp: string): Promise<AirPlayResult> {
  const ports = [7000, 5000];
  const errors: Error[] = [];

  for (const port of ports) {
    try {
      return await queryAirPlayPort(targetIp, port);
    } catch (error) {
      // Continue to next port
      errors.push(error as Error);
    }
  }

  throw new Error(
    `All AirPlay direct connection methods failed: ${errors.map((e) => e.message).join(', ')}`,
  );
}

/**
 * AirPlay service configuration
 */
export const AIRPLAY_SERVICE: ServiceConfig = {
  query: '_airplay._tcp.local',
  defaultPort: 7000,
  directConnection: queryAirPlayDirect,
};
