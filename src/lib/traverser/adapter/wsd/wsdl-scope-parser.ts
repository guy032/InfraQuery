/**
 * WSDL Scope Parser Module
 * Extracts device information from WS-Discovery scope strings
 */

import type { ScopeInfo } from './types';

/**
 * Extract scope information from WS-Discovery response
 */
export function extractScopeInfo(scopeText: any): ScopeInfo {
  const extractedInfo: ScopeInfo = {};

  if (!scopeText) {
    return extractedInfo;
  }

  const scopes = typeof scopeText === 'string' ? scopeText : scopeText['#text'] || scopeText;

  for (const token of scopes.split(' ')) {
    const parts = token.split('/');
    const key = parts.at(-2);
    const valuePart = parts.at(-1);

    if (!key || !valuePart) {
      continue;
    }

    const value =
      valuePart.includes(':') && key !== 'mac'
        ? decodeURIComponent(valuePart.split(':').pop() || '')
        : decodeURIComponent(valuePart);

    if (key === 'mac' && value) {
      const macRegex = /^([\dA-Fa-f]{2}[:-]){5}([\dA-Fa-f]{2})$/;

      if (macRegex.test(value)) {
        extractedInfo.macAddress = value;
      }
    } else if (['name', 'hardware', 'type', 'location'].includes(key)) {
      if (extractedInfo[key]) {
        if (!Array.isArray(extractedInfo[key])) {
          extractedInfo[key] = [extractedInfo[key]];
        }

        extractedInfo[key].push(value);
      } else {
        extractedInfo[key] = value;
      }
    }
  }

  // Parse manufacturer and model from name/hardware
  if (
    extractedInfo.name &&
    extractedInfo.hardware &&
    typeof extractedInfo.name === 'string' &&
    typeof extractedInfo.hardware === 'string'
  ) {
    extractedInfo.manufacturer = extractedInfo.name
      .replace(new RegExp(extractedInfo.hardware, 'i'), '')
      .trim();
    extractedInfo.model = extractedInfo.hardware;
    delete extractedInfo.name;
    delete extractedInfo.hardware;
  }

  return extractedInfo;
}
