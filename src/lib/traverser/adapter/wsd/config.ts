/**
 * SOAP/WSDL Service Configuration
 * Defines which SOAP operations to execute for each device type
 */

/**
 * Get SOAP actions configuration for a specific service type
 */
export function getConfigByEndpointType(serviceType: any): any {
  const { type, xmlns } = serviceType;

  switch (type) {
    // ========================================================================
    // ONVIF Camera (Network Video Transmitter)
    // ========================================================================
    case 'NetworkVideoTransmitter':

    //eslint-disable-next-line no-fallthrough
    case 'network_video_transmitter': {
      const sanitizedXmlns = xmlns.replace(/^(\w+:)?\/\//, '');

      if (sanitizedXmlns.startsWith('www.onvif.org')) {
        const devicemgmt = 'www.onvif.org/ver10/device/wsdl';
        const media = 'www.onvif.org/ver10/media/wsdl';

        return {
          type: 'ws',
          actions: [
            // ========================================================================
            // PRE_AUTH operations (guaranteed to work without auth per ONVIF spec)
            // ========================================================================
            {
              operation: 'GetServices',
              wsdlFile: `${devicemgmt}/devicemgmt.wsdl`,
              xmlns: `http://${devicemgmt}`,
              // ✅ PRE_AUTH: Returns list of ONVIF services + XAddr + version
              body: { IncludeCapability: false },
            },
            {
              operation: 'GetServiceCapabilities',
              wsdlFile: `${devicemgmt}/devicemgmt.wsdl`,
              xmlns: `http://${devicemgmt}`,
              // ✅ PRE_AUTH: Returns Device service's feature flags (security, network, system)
            },
            {
              operation: 'GetWsdlUrl',
              wsdlFile: `${devicemgmt}/devicemgmt.wsdl`,
              xmlns: `http://${devicemgmt}`,
              // ✅ PRE_AUTH: Returns URL to fetch WSDLs
            },
            {
              operation: 'GetHostname',
              wsdlFile: `${devicemgmt}/devicemgmt.wsdl`,
              xmlns: `http://${devicemgmt}`,
              // ✅ PRE_AUTH: Works without authentication (returns hostname info)
            },
            {
              operation: 'GetSystemDateAndTime',
              wsdlFile: `${devicemgmt}/devicemgmt.wsdl`,
              xmlns: `http://${devicemgmt}`,
              // ✅ PRE_AUTH: Works without authentication (returns date/time/timezone)
            },

            // ========================================================================
            // Opportunistic operations (often work without auth but not guaranteed)
            // ========================================================================
            {
              operation: 'GetCapabilities',
              wsdlFile: `${devicemgmt}/devicemgmt.wsdl`,
              xmlns: `http://${devicemgmt}`,
              // ⚠️ Opportunistic: Works on many devices but not guaranteed by spec
              body: { Category: 'All' },
            },

            // ========================================================================
            // Operations requiring authentication
            // ========================================================================
            {
              operation: 'GetDeviceInformation',
              wsdlFile: `${devicemgmt}/devicemgmt.wsdl`,
              xmlns: `http://${devicemgmt}`,
              authorizationRequest: true,
              // ❌ Requires auth: Returns manufacturer, model, firmware, serial
            },
            {
              operation: 'GetNetworkInterfaces',
              wsdlFile: `${devicemgmt}/devicemgmt.wsdl`,
              xmlns: `http://${devicemgmt}`,
              authorizationRequest: true,
              // ❌ Requires auth: Returns network interface details
            },
            {
              operation: 'GetProfiles',
              wsdlFile: `${media}/media.wsdl`,
              xmlns: `http://${media}`,
              authorizationRequired: true,
              // ❌ Requires auth: Returns media profiles
            },
          ],
        };
      }

      return null;
    }

    // ========================================================================
    // WSD Printer
    // ========================================================================
    case 'PrintDeviceType':

    //eslint-disable-next-line no-fallthrough
    case 'printer_service_type': {
      return {
        type: 'ws',
        actions: [
          {
            operation: 'GetPrinterElements',
            wsdlFile: 'schemas.microsoft.com/windows/2006/08/wdp/print/WDPPrint.wsdl',
            xmlns: 'http://schemas.microsoft.com/windows/2006/08/wdp/print',
            namespacePrefix: 'wprt', // Default prefix for WSD printer namespace
            body: {
              RequestedElements: {
                Name: [
                  'PrinterStatus',
                  'PrinterDescription',
                  'PrinterConfiguration',
                  'PrinterCapabilities',
                  'DefaultPrintTicket',
                ],
              },
            },
            authorizationRequest: true,
            prepare: (body, service) => {
              // Use the detected namespace prefix from metadata (vendor-agnostic)
              const { prefix } = service;

              // Build XML string manually to ensure proper namespace prefixing
              const elements = body.RequestedElements.Name.map(
                (name) => `<${prefix}:Name>${prefix}:${name}</${prefix}:Name>`,
              ).join('');

              const xmlBody = `<${prefix}:RequestedElements>${elements}</${prefix}:RequestedElements>`;

              // Use $xml to inject raw XML (node-soap special property)
              return { $xml: xmlBody };
            },
          },
          {
            operation: 'GetJobHistory',
            wsdlFile: 'schemas.microsoft.com/windows/2006/08/wdp/print/WDPPrint.wsdl',
            xmlns: 'http://schemas.microsoft.com/windows/2006/08/wdp/print',
            namespacePrefix: 'wprt',
            body: {},
          },
        ],
      };
    }

    // ========================================================================
    // WSD Scanner
    // ========================================================================
    case 'ScanDeviceType':

    //eslint-disable-next-line no-fallthrough
    case 'scanner_service_type': {
      return {
        type: 'ws',
        actions: [
          {
            operation: 'GetScannerElements',
            wsdlFile: 'schemas.microsoft.com/windows/2006/08/wdp/scan/WDPScan.wsdl',
            xmlns: 'http://schemas.microsoft.com/windows/2006/08/wdp/scan',
            namespacePrefix: 'wscn', // Default prefix for WSD scanner namespace
            body: {
              RequestedElements: {
                Name: [
                  'ScannerDescription',
                  'ScannerConfiguration',
                  'ScannerStatus',
                  'DefaultScanTicket',
                ],
              },
            },
            authorizationRequest: true,
            prepare: (body, service) => {
              // Use the detected namespace prefix from metadata (vendor-agnostic)
              const { prefix } = service;

              // Build XML string manually to ensure proper namespace prefixing
              const elements = body.RequestedElements.Name.map(
                (name) => `<${prefix}:Name>${prefix}:${name}</${prefix}:Name>`,
              ).join('');

              const xmlBody = `<${prefix}:RequestedElements>${elements}</${prefix}:RequestedElements>`;

              // Use $xml to inject raw XML (node-soap special property)
              return { $xml: xmlBody };
            },
          },
        ],
      };
    }

    // ========================================================================
    // Default: WS-Transfer Get (Metadata Exchange)
    // ========================================================================
    default: {
      const wsdlFile = 'schemas.xmlsoap.org/ws/2004/09/transfer';

      return {
        type: 'ws',
        actions: [
          {
            operation: 'Get',
            wsdlFile: `${wsdlFile}/transfer.wsdl`,
            xmlns: `http://${wsdlFile}`,
          },
        ],
      };
    }
  }
}

/**
 * Add prefix to all keys in an object recursively
 */
export function addKeyPrefixes(obj: any, prefix: string): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => addKeyPrefixes(item, prefix));
  }

  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = key.includes(':') ? key : `${prefix}:${key}`;
    result[newKey] = addKeyPrefixes(value, prefix);
  }

  return result;
}

/**
 * Convert camelCase to snake_case
 */
export function camelToSnakeCase(str: string): string {
  return str.replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 */
export function snakeToCamelCase(str: string): string {
  return str.replaceAll(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}
