/**
 * S7 Response Parser Module
 * Handles parsing and validation of S7 protocol responses
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
import log from '../../lib/infrastructure/logger';
import type { ComponentInfo, ModuleInfo, ModuleStatusInfo } from './types';

/**
 * Validate COTP Connection Response
 */
export function validateCOTPResponse(data: Buffer): boolean {
  // TPKT version (0x03) and COTP CC (Connection Confirm 0xd0)
  return data.length >= 22 && data[0] === 0x03 && data[5] === 0xd0;
}

/**
 * Validate S7 Setup Response
 */
export function validateS7SetupResponse(data: Buffer): boolean {
  // Check TPKT version (0x03), S7 Protocol ID (0x32), and Ack data (0x03)
  return data.length >= 25 && data[0] === 0x03 && data[7] === 0x32 && data[8] === 0x03;
}

/**
 * Parse SZL Response
 */
export function parseSZLResponse(data: Buffer): Buffer {
  // Skip TPKT (4), COTP (3), S7 header (12), parameter header
  // Find the actual SZL data
  if (data.length < 30) {
    throw new Error('SZL response too short');
  }

  log.verbose(`Parsing SZL response (total ${data.length} bytes)`);
  log.verbose(`Full packet hex: ${data.toString('hex')}`);

  // S7 Header structure:
  // [0-3]   TPKT header
  // [4-6]   COTP header
  // [7]     Protocol ID (0x32)
  // [8]     Message type
  // [9-10]  Reserved
  // [11-12] PDU reference
  // [13-14] Parameter length
  // [15-16] Data length

  const protocolId = data[7];
  const messageType = data[8];
  const paramLength = data.readUInt16BE(13);
  const dataLength = data.readUInt16BE(15);

  log.verbose(
    `S7 header: protocolId=0x${protocolId.toString(16)}, ` +
      `msgType=0x${messageType.toString(16)}, paramLen=${paramLength}, dataLen=${dataLength}`,
  );

  // Check for error response (message type 0x02 or 0x03 is ACK with error)
  if (messageType === 0x02 || messageType === 0x03) {
    log.verbose(`Response is ACK/ACK-DATA, checking for errors`);
  }

  // Calculate where data section starts:
  // TPKT(4) + COTP(3) + S7Header(12) + Parameters(paramLength) = data start
  const dataStart = 4 + 3 + 12 + paramLength;

  log.verbose(`Data section should start at offset ${dataStart}`);

  if (dataStart + dataLength > data.length) {
    log.verbose(
      `Warning: data section extends beyond buffer (need ${dataStart + dataLength}, have ${data.length})`,
    );
  }

  // Look for the data section marker (0xFF 0x09)
  let dataPayloadStart = dataStart;

  for (let i = dataStart; i < Math.min(dataStart + 10, data.length - 1); i++) {
    if (data[i] === 0xff && data[i + 1] === 0x09) {
      dataPayloadStart = i + 4; // Skip 0xFF 0x09 and 2-byte length
      log.verbose(`Found data marker at offset ${i}, payload starts at ${dataPayloadStart}`);
      break;
    }
  }

  if (dataPayloadStart >= data.length) {
    throw new Error('No data section found in SZL response');
  }

  // Extract SZL data payload
  const payload = data.slice(dataPayloadStart);
  log.verbose(`Extracted payload: ${payload.length} bytes`);
  log.verbose(`Payload hex: ${payload.toString('hex')}`);

  return payload;
}

/**
 * Clean a buffer string - remove null bytes, control characters, excess whitespace
 */
function cleanString(buffer: Buffer): string {
  return (
    buffer
      .toString('ascii')
      .replaceAll('\0', '') // Remove null bytes
      // eslint-disable-next-line no-control-regex
      .replaceAll(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '') // Remove control chars
      .replaceAll(/\s+/g, ' ') // Collapse whitespace
      .trim()
  );
}

/**
 * Parse SZL 0x0424 (proprietary format used by some older S7-300 PLCs)
 * This SZL contains binary-encoded device information
 */
function parseSZL0424(data: Buffer): ModuleInfo | ComponentInfo {
  const info: Partial<ModuleInfo & ComponentInfo> = {};

  try {
    log.verbose(`Parsing SZL 0x0424 (${data.length} bytes)`);

    if (data.length < 20) {
      return info;
    }

    // Parse header
    const recordLength = data.readUInt16BE(0);
    const szlId = data.readUInt16BE(2);
    const index = data.readUInt16BE(4);

    log.verbose(
      `SZL 0x0424: recordLen=${recordLength}, szlId=0x${szlId.toString(16)}, index=0x${index.toString(16)}`,
    );

    // Log raw data for debugging
    log.verbose(`Full SZL 0x0424 data (${data.length} bytes): ${data.toString('hex')}`);

    // Try to extract data from known positions
    // Based on observation, interesting data starts around byte 22
    if (data.length >= 28) {
      // Try different byte positions for model info
      // Bytes 22-23 seem to contain interesting data (e.g., 0x2510)
      const byte22 = data[22];
      const byte23 = data[23];

      log.verbose(
        `Bytes 22-23: 0x${byte22.toString(16).padStart(2, '0')} ` +
          `0x${byte23.toString(16).padStart(2, '0')} (decimal: ${byte22}, ${byte23})`,
      );

      // Try interpreting as BCD (e.g., 0x2510 might be 25.10 or 2510)
      // eslint-disable-next-line no-bitwise
      const bcd1 =
        // eslint-disable-next-line no-bitwise
        ((byte22 >> 4) * 10 + (byte22 & 0x0f)) * 100 + ((byte23 >> 4) * 10 + (byte23 & 0x0f));
      log.verbose(`  As BCD (2 bytes): ${bcd1}`);

      // Try just the first byte
      // eslint-disable-next-line no-bitwise
      const firstByteBCD = (byte22 >> 4) * 10 + (byte22 & 0x0f);
      log.verbose(`  First byte as BCD: ${firstByteBCD}`);

      // Also try as raw hex interpretation for 315
      const rawHex = data.readUInt16BE(22);
      log.verbose(`  As raw hex (16-bit): 0x${rawHex.toString(16)} = ${rawHex}`);

      // Check if first byte looks like a CPU family (e.g., 31 in BCD = 31, or 0x31 hex = 49)
      if (byte22 === 0x31 || firstByteBCD === 31) {
        // Try to get the model number from byte 23
        // eslint-disable-next-line no-bitwise
        const modelBCD = (byte23 >> 4) * 10 + (byte23 & 0x0f);
        info.cpuModel = `CPU ${firstByteBCD}${modelBCD}`;
        log.verbose(`  -> Detected CPU model: ${info.cpuModel}`);
      }

      // Try fingerprint-based identification using constant bytes
      // Bytes 10-11 and 22-23 appear constant across requests
      const fingerprint1 = data.readUInt16BE(10); // bytes 10-11
      const fingerprint2 = data.readUInt16BE(22); // bytes 22-23

      log.verbose(`  Fingerprint bytes [10-11]: 0x${fingerprint1.toString(16).padStart(4, '0')}`);
      log.verbose(`  Fingerprint bytes [22-23]: 0x${fingerprint2.toString(16).padStart(4, '0')}`);

      // Known fingerprints for specific CPU models (based on observation)
      // This is a lookup table approach since the encoding appears proprietary
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const knownFingerprints: Record<string, string> = {
        51_442_510: 'CPU 315-2', // fingerprint1=0x5144, fingerprint2=0x2510
        51_442_511: 'CPU 315',
        51_442_410: 'CPU 314-2',
        51_442_310: 'CPU 313-2',
        51_442_610: 'CPU 316-2',
        51_442_710: 'CPU 317-2',
        51_442_810: 'CPU 318-2',
      };

      const fingerprintKey = `${fingerprint1.toString(16)}${fingerprint2.toString(16)}`;
      log.verbose(`  Fingerprint key: ${fingerprintKey}`);

      if (knownFingerprints[fingerprintKey]) {
        info.cpuModel = knownFingerprints[fingerprintKey];
        log.verbose(`  -> Detected CPU model from fingerprint: ${info.cpuModel}`);
      } else {
        // Fallback: Try nibble decoding
        // eslint-disable-next-line no-bitwise
        const nibble22h = (byte22 >> 4) & 0x0f; // 2
        // eslint-disable-next-line no-bitwise
        const nibble22l = byte22 & 0x0f; // 5
        // eslint-disable-next-line no-bitwise
        const nibble23h = (byte23 >> 4) & 0x0f; // 1
        // eslint-disable-next-line no-bitwise
        const nibble23l = byte23 & 0x0f; // 0

        log.verbose(`  Nibbles [22-23]: ${nibble22h}, ${nibble22l}, ${nibble23h}, ${nibble23l}`);
        log.verbose(`  Pattern: ${nibble22l}${nibble23h}${nibble22h} (reverse nibble order)`);

        // Try pattern: nibble22l, nibble23h, nibble22h = 5, 1, 2 → "312" or "315"
        const modelNum = `${nibble22l}${nibble23h}${nibble22h}`;

        if (modelNum >= '300' && modelNum < '400') {
          info.cpuModel = `CPU ${modelNum}`;
          log.verbose(`  -> Detected CPU model from nibble fallback: ${info.cpuModel}`);
        }
      }

      // Try to find ASCII patterns in the data
      for (let i = 10; i < Math.min(data.length - 10, 40); i++) {
        const slice = data.slice(i, i + 10);
        const ascii = slice.toString('ascii').replaceAll(/[^\u0020-\u007E]/gu, '');

        if (ascii.length >= 4 && /[\dA-Z]{4,}/u.test(ascii)) {
          log.verbose(`  Found ASCII pattern at offset ${i}: "${ascii}"`);
        }
      }
    }

    return info;
  } catch (error) {
    log.verbose(`Error parsing SZL 0x0424: ${error.message}`);

    return info;
  }
}

/**
 * Parse Module Identification data
 * SZL 0x0011 returns module identification in a structured format
 */
export function parseModuleIdentification(data: Buffer): ModuleInfo {
  try {
    const info: ModuleInfo = {};

    log.verbose(`Parsing module ID (${data.length} bytes)`);

    // Debug: Log raw hex data
    if (data.length >= 10) {
      log.verbose(
        `First 30 bytes (hex): ${data.slice(0, Math.min(30, data.length)).toString('hex')}`,
      );
    }

    if (data.length < 10) {
      log.verbose('Module ID response too short');

      return info;
    }

    // Check if this is SZL 0x0424 (proprietary format)
    if (data.length >= 4) {
      const szlId = data.readUInt16BE(2);

      if (szlId === 0x04_24) {
        log.verbose('Detected SZL 0x0424 format, using specialized parser');

        return parseSZL0424(data) as ModuleInfo;
      }
    }

    // SZL 0x0011 response format:
    // [0-1]   Record length (length - 4)
    // [2-3]   SZL ID (0x0011)
    // [4-5]   Index (0x0000)
    // [6-7]   Unknown field (usually 0x001C or similar)
    // [8-9]   Count (number of entries, usually 1)
    // [10-11] Index field for first entry
    // [12-31] Module name/order number (20 bytes ASCII)
    // [32-39] Additional info (8 bytes)

    const recordLength = data.readUInt16BE(0);
    const szlId = data.readUInt16BE(2);
    const index = data.readUInt16BE(4);
    const count = data.readUInt16BE(8);

    log.verbose(
      `SZL structure: length=${recordLength}, id=0x${szlId.toString(16).padStart(4, '0')}, ` +
        `index=0x${index.toString(16).padStart(4, '0')}, count=${count}`,
    );

    // The actual module name starts at offset 12 (after the header and entry index)
    // It's typically 20 bytes for the article/order number
    if (data.length >= 32) {
      // Extract article number (bytes 12-31, 20 bytes)
      const articleBytes = data.slice(12, 32);
      const article = cleanString(articleBytes);

      log.verbose(`Raw article bytes (12-31): ${articleBytes.toString('hex')}`);
      log.verbose(`Article/Order number: "${article}"`);

      if (article && article.length > 0) {
        info.orderNumber = article;

        // Try to extract CPU model from the article number
        // Format is usually like "6ES7 315-2AH14-0AB0" where "315-2" indicates the CPU type
        const cpuMatch = article.match(/6ES7\s*(\d{3}[^-]*-\S+)/);

        if (cpuMatch) {
          info.cpuModel = `CPU ${cpuMatch[1]}`;
          log.verbose(`Extracted CPU model from article: ${info.cpuModel}`);
        }
      }

      // Additional module name might be in the next 20 bytes if available
      if (data.length >= 52) {
        const moduleNameBytes = data.slice(32, 52);
        const moduleName = cleanString(moduleNameBytes);

        log.verbose(`Raw module name bytes (32-51): ${moduleNameBytes.toString('hex')}`);

        if (moduleName && moduleName.length > 3 && !info.cpuModel) {
          info.cpuModel = moduleName;
          log.verbose(`Extracted CPU model from extended field: ${moduleName}`);
        }
      }
    }

    return info;
  } catch (error) {
    log.verbose(`Error parsing module identification: ${error.message}`);

    return {};
  }
}

/**
 * Parse Component Identification data
 * SZL 0x001C can contain multiple records with different component information
 */
export function parseComponentIdentification(data: Buffer): ComponentInfo {
  try {
    const info: ComponentInfo = {};

    log.verbose(`Parsing component ID (${data.length} bytes)`);

    // Debug: Log raw hex data
    if (data.length >= 10) {
      log.verbose(
        `Component ID - First 30 bytes (hex): ${data.slice(0, Math.min(30, data.length)).toString('hex')}`,
      );
    }

    // SZL 0x001C response format:
    // [0-1]   Record length (total length - 4)
    // [2-3]   SZL ID (0x001C)
    // [4-5]   Index
    // [6-7]   Unknown (0x0022 typically)
    // [8-9]   Count (number of text fields)
    // Then: sequence of (2-byte type + 32-byte text) pairs

    if (data.length < 10) {
      log.verbose('Component ID response too short');

      return info;
    }

    const recordLength = data.readUInt16BE(0);
    const szlId = data.readUInt16BE(2);
    const index = data.readUInt16BE(4);
    const count = data.readUInt16BE(8);

    log.verbose(
      `SZL 0x${szlId.toString(16).padStart(4, '0')}, index 0x${index.toString(16).padStart(4, '0')}: ${count} text fields`,
    );

    // Check if this is SZL 0x0424 (proprietary format)
    if (szlId === 0x04_24) {
      log.verbose('Detected SZL 0x0424 format in component ID, using specialized parser');

      return parseSZL0424(data) as ComponentInfo;
    }

    // Parse text fields - each is 2-byte type + 32-byte text
    const FIELD_SIZE = 34; // 2 + 32
    let offset = 10; // Start after header
    const fields: string[] = [];

    for (let i = 0; i < count && offset + FIELD_SIZE <= data.length; i++) {
      const fieldType = data.readUInt16BE(offset);
      offset += 2;

      const textData = data.slice(offset, offset + 32);
      const text = cleanString(textData);

      if (text) {
        log.verbose(
          `  Field ${i + 1} (type 0x${fieldType.toString(16).padStart(4, '0')}): "${text}"`,
        );
        fields.push(text);
      } else {
        log.verbose(
          `  Field ${i + 1} (type 0x${fieldType.toString(16).padStart(4, '0')}): (empty)`,
        );
        fields.push('');
      }

      offset += 32;
    }

    // Map fields based on their typical positions
    // Field 0: PLC Name (e.g., "SIMATIC 300(1)")
    // Field 1: Module Type (e.g., "CPU 315-2 PN/DP")
    // Field 2: (often empty or additional info)
    // Field 3: Copyright (e.g., "Original Siemens Equipment")
    // Field 4: Serial Number (e.g., "S C-E1U391962014")
    // Field 5: Module Name (e.g., "CPU 315-2 PN/DP")

    if (fields.length > 0 && fields[0]) {
      info.moduleName = fields[0];
      log.verbose(`  -> PLC Name: ${fields[0]}`);
    }

    if (fields.length > 1 && fields[1]) {
      info.moduleTypeName = fields[1];
      log.verbose(`  -> Module Type: ${fields[1]}`);
    }

    if (
      fields.length > 3 &&
      fields[3] &&
      (fields[3].toLowerCase().includes('copyright') || fields[3].toLowerCase().includes('siemens'))
    ) {
      info.copyright = fields[3];
      log.verbose(`  -> Copyright: ${fields[3]}`);
    }

    if (fields.length > 4 && fields[4] && (fields[4].includes('C-') || fields[4].includes('S '))) {
      info.serialNumber = fields[4];
      log.verbose(`  -> Serial Number: ${fields[4]}`);
    }

    // Look for additional patterns in all fields
    for (const [i, field] of fields.entries()) {
      if (!field) {
        continue;
      }

      // Order number pattern (e.g., "6ES7 315-2EH14-0AB0  v.0.5")
      if (/6ES7|6EP|6AG|6AV|6GK/.test(field) && !info.orderNumber) {
        const parts = field.split(/\s{2,}/); // Split on 2+ spaces
        info.orderNumber = parts[0].trim();
        log.verbose(`  -> Order Number from field ${i}: ${info.orderNumber}`);

        if (parts.length > 1 && /v\.\d+\.\d+/.test(parts[1])) {
          info.hardwareVersion = parts[1].trim();
          log.verbose(`  -> Hardware Version: ${info.hardwareVersion}`);
        }
      }

      // Firmware version (v.x.x.x format)
      if (/v(?:\.\d+){3}/.test(field) && !info.firmwareVersion) {
        const match = field.match(/(v(?:\.\d+){3})/);

        if (match) {
          info.firmwareVersion = match[1];
          log.verbose(`  -> Firmware Version from field ${i}: ${info.firmwareVersion}`);
        }
      }

      // Bootloader
      if (field.toLowerCase().includes('boot') && !info.bootloaderVersion) {
        info.bootloaderVersion = field;
        log.verbose(`  -> Bootloader from field ${i}: ${field}`);
      }

      // Plant identification (short code, not matching other patterns)
      if (
        i > 5 &&
        field.length < 20 &&
        field.length > 0 &&
        !info.plantIdentification &&
        !field.includes('CPU') &&
        !field.includes('Siemens') &&
        !field.includes('6ES7') &&
        !/v\.\d/.test(field)
      ) {
        info.plantIdentification = field;
        log.verbose(`  -> Plant ID from field ${i}: ${field}`);
      }
    }

    return info;
  } catch (error) {
    log.verbose(`Error parsing component identification: ${error.message}`);

    return {};
  }
}

/**
 * Parse Module Status (SZL 0x0111) - might contain additional info
 */
export function parseModuleStatus(data: Buffer): ModuleStatusInfo {
  try {
    const info: ModuleStatusInfo = {};
    log.verbose(`Parsing module status (${data.length} bytes)`);

    // Module status SZL can contain hardware/firmware details
    // Format varies by PLC model, extract what we can
    if (data.length > 20) {
      // Try to extract any readable strings
      const text = data
        .toString('ascii')
        // eslint-disable-next-line no-control-regex
        .replaceAll(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
        .replaceAll(/\s+/g, ' ')
        .trim();

      if (text.length > 3) {
        log.verbose(`Module status text: ${text}`);
      }
    }

    return info;
  } catch (error) {
    log.verbose(`Error parsing module status: ${error.message}`);

    return {};
  }
}
