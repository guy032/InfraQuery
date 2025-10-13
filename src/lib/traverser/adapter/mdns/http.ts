/**
 * HTTP-related mDNS service parsers
 * Handles HTTP, QDiscover, Workstation, and SMB services
 */

import type { HttpServiceData, QDiscoverServiceData, ServiceConfig } from './types';

/**
 * HTTP service configuration
 */
export const HTTP_SERVICE: ServiceConfig = {
  query: '_http._tcp.local',
  defaultPort: 8080,
  directConnection: null,
};

/**
 * HTTP-specific data parsing
 */
export function parseHttpServiceData(txtData: Record<string, string>): HttpServiceData {
  const parsedData: HttpServiceData = {
    name: '',
    port: 0,
    protocol: 'http',
    addresses: [],
    path: txtData.path || '',
    unitname: txtData.unitname || '',
    serialnumber: txtData.serialnumber || '',
    unitnamingmethod: txtData.unitnamingmethod || '',
    unitdescription: txtData.unitdescription || '',
    functionality: txtData.functionality || '',
    ...txtData, // Include any additional TXT data
  };

  // Extract common device information fields
  if (txtData.vendor) {
    parsedData.vendor = txtData.vendor;
  }

  if (txtData.model) {
    parsedData.model = txtData.model;
  }

  if (txtData.manufacturer) {
    parsedData.manufacturer = txtData.manufacturer;
  }

  if (txtData.version) {
    parsedData.version = txtData.version;
  }

  if (txtData.hostname) {
    parsedData.hostname = txtData.hostname;
  }

  if (txtData.name) {
    parsedData.name = txtData.name;
  }

  if (txtData.serial) {
    parsedData.serial = txtData.serial;
  }

  return parsedData;
}

/**
 * QDiscover (QNAP device discovery) service data parsing
 */
export function parseQDiscoverServiceData(txtData: Record<string, string>): QDiscoverServiceData {
  const parsedData: QDiscoverServiceData = {
    name: '',
    port: 0,
    protocol: 'qdiscover',
    addresses: [],
    accessType: txtData.accesstype || '',
    accessPort: txtData.accessport || '',
    model: txtData.model || '',
    displayModel: txtData.displaymodel || '',
    fwVer: txtData.fwver || '',
    fwBuildNum: txtData.fwbuildnum || '',
    ...txtData,
  };

  // Extract common device information fields
  if (txtData.vendor) {
    parsedData.vendor = txtData.vendor;
  }

  if (txtData.manufacturer) {
    parsedData.manufacturer = txtData.manufacturer;
  }

  if (txtData.version) {
    parsedData.version = txtData.version;
  }

  if (txtData.hostname) {
    parsedData.hostname = txtData.hostname;
  }

  if (txtData.name) {
    parsedData.name = txtData.name;
  }

  if (txtData.serial) {
    parsedData.serial = txtData.serial;
  }

  return parsedData;
}

/**
 * Workstation service data parsing
 */
export function parseWorkstationServiceData(txtData: Record<string, string>): Record<string, any> {
  // Workstation services typically don't have TXT records
  return {};
}

/**
 * SMB service data parsing
 */
export function parseSmbServiceData(txtData: Record<string, string>): Record<string, any> {
  // SMB services typically don't have TXT records
  return {};
}

/**
 * Generic service data parser for HTTP-related services
 */
export function parseHttpRelatedServiceData(
  serviceType: string,
  txtData: Record<string, string>,
): Record<string, any> {
  switch (serviceType) {
    case 'http': {
      return parseHttpServiceData(txtData);
    }

    case 'qdiscover': {
      return parseQDiscoverServiceData(txtData);
    }

    case 'workstation': {
      return parseWorkstationServiceData(txtData);
    }

    case 'smb': {
      return parseSmbServiceData(txtData);
    }

    default: {
      return txtData;
    }
  }
}
