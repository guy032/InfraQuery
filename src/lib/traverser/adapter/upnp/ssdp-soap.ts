/**
 * SSDP SOAP Request Module
 * Handles SOAP requests to UPnP services
 */

import axios from 'axios';
import xml2js from 'xml2js';

/**
 * Make SOAP request to UPnP service
 */
export async function makeSOAPRequest(
  controlUrl: string,
  action: string,
  serviceType: string,
  params: Record<string, any> = {},
): Promise<any> {
  const paramXml = Object.entries(params)
    .map(([key, value]) => `<${key}>${value}</${key}>`)
    .join('');

  const payload = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
<s:Body>
<u:${action} xmlns:u="${serviceType}">${paramXml}</u:${action}>
</s:Body>
</s:Envelope>`;

  try {
    const response = await axios.post(controlUrl, payload, {
      headers: {
        SOAPAction: `"${serviceType}#${action}"`, // eslint-disable-line quote-props
        'Content-Type': 'text/xml;charset="utf-8"',
      },
      timeout: 3000,
      validateStatus: (status) => status < 500,
    });

    if (response.status === 200) {
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(response.data);

      return result['s:Envelope']['s:Body'][0][`u:${action}Response`]?.[0] || {};
    }
  } catch {
    // Silent fail
  }

  return null;
}
