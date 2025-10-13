/**
 * WSDL SOAP Client Module
 * Handles SOAP client creation and operation execution
 */

import path from 'path';

import type { ServiceType, SoapExecutionResult } from './types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { v4: uuidv4 } = require('uuid');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const axios = require('axios');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient, WSSecurity } = require('soap');

/**
 * Create HTTP client for SOAP requests with retry logic
 */
function createHttpClient(soapTimeout: number): any {
  return {
    request: (rurl: string, data: string, callback: any, headers: any): void => {
      // Clean up optional XML messages
      if (data) {
        data = data.replace(
          /<soap:Body>(?=.*OptionalXmlMessage).*?<\/soap:Body>/s,
          '<soap:Body />',
        );
      }

      const retryRequest = (url: string, data: string, headers: any, retriesLeft: number): void => {
        axios
          .post(url, data, { headers, timeout: soapTimeout })
          .then((response) => {
            callback(null, response, response.data.replaceAll('&', '&amp;'));
          })
          .catch((error) => {
            if (retriesLeft === 0 || error.code !== 'ECONNABORTED') {
              callback(error);
            } else {
              setTimeout(() => {
                retryRequest(url, data, headers, retriesLeft - 1);
              }, 1000);
            }
          });
      };

      retryRequest(rurl, data, headers, 2);
    },
  };
}

/**
 * Execute SOAP operation on an endpoint
 */
export async function executeSoapOperation(
  endpoint: string,
  uuid: string,
  serviceType: ServiceType,
  operation: string,
  wsdlFile: string,
  xmlns: string,
  body: any = {},
  prepare: ((body: any, serviceType: ServiceType) => any) | null = null,
  namespacePrefix: string | null = null,
  isMetadataExchange = false,
  username: string | null = null,
  password: string | null = null,
  soapTimeout = 5000,
): Promise<SoapExecutionResult> {
  return new Promise<SoapExecutionResult>((resolve, reject) => {
    const wsdlPath = path.resolve(__dirname, wsdlFile);
    // Use the provided namespacePrefix if available, otherwise fall back to serviceType prefix
    const prefix = namespacePrefix || serviceType.prefix;

    createClient(
      wsdlPath,
      {
        disableCache: true,
        forceSoap12Headers: true,
        useEmptyTag: wsdlFile.includes('transfer.wsdl'),
        overrideRootElement: xmlns
          ? {
              namespace: prefix,
              xmlnsAttributes: [
                {
                  name: `xmlns:${prefix}`,
                  value: xmlns,
                },
              ],
            }
          : undefined,
        httpClient: createHttpClient(soapTimeout),
      },
      (error, client) => {
        if (error) {
          reject(error);

          return;
        }

        // Add WS-Security authentication if credentials are provided
        if (username && password) {
          const wsSecurity = new WSSecurity(username, password, {
            passwordType: 'PasswordDigest', // Use digest instead of plain text
            hasTimeStamp: true, // ONVIF requires timestamps
            hasTokenCreated: true, // Include token creation timestamp
          });
          client.setSecurity(wsSecurity);
        }

        // Add WS-Addressing headers
        const wsa = ' xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"';

        if (!client.wsdl.xmlnsInEnvelope.includes(wsa)) {
          client.wsdl.xmlnsInEnvelope += wsa;
        }

        const { $targetNamespace } = client.wsdl.definitions;
        const wsaAction = `${xmlns || $targetNamespace}/${operation}`;

        // Universal approach: Use UUID for metadata exchange, endpoint URL for service operations
        const wsaTo = isMetadataExchange ? (uuid ? `urn:uuid:${uuid}` : endpoint) : endpoint;

        client.addSoapHeader({
          'wsa:Action': wsaAction,
          'wsa:MessageID': `urn:uuid:${uuidv4()}`,
          'wsa:ReplyTo': {
            'wsa:Address': 'http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous',
          },
          'wsa:To': wsaTo,
        });

        client.setEndpoint(endpoint);
        client.setSOAPAction(wsaAction);
        client.addHttpHeader('SOAPAction', wsaAction);

        const actionBody = prepare ? prepare(body, serviceType) : body;

        client[operation](actionBody, (err, jsonBody, xmlResponse) => {
          if (err) {
            const status = err.response?.status;
            resolve({ error: err, status, operation });

            return;
          }

          resolve({ jsonBody, xmlResponse, operation });
        });
      },
    );
  });
}
