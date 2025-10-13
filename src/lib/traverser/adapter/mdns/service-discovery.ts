/**
 * Comprehensive DNS-SD Service Types Registry
 * Based on the RFC 2782 Service Types registry
 * http://www.dns-sd.org/ServiceTypes.html
 */

import type { DnsQuestion } from './types';

/**
 * Service category type
 */
export type ServiceCategory =
  | 'CORE'
  | 'MEDIA'
  | 'PRINTING'
  | 'FILE_SHARING'
  | 'DEVICE_MGMT'
  | 'NAS_STORAGE'
  | 'SECURITY';

/**
 * Priority level type
 */
export type PriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * DNS-SD Service Types Registry organized by categories
 */
export const DNS_SD_SERVICE_REGISTRY: Record<ServiceCategory, string[]> = {
  CORE: [
    '_http._tcp.local',
    '_https._tcp.local',
    '_smb._tcp.local',
    '_workstation._tcp.local',
    '_ssh._tcp.local',
    '_ftp._tcp.local',
  ],
  MEDIA: [
    '_airplay._tcp.local',
    '_googlecast._tcp.local',
    '_chromecast._tcp.local',
    '_raop._tcp.local',
    '_daap._tcp.local',
    '_rtsp._tcp.local',
    '_spotify-connect._tcp.local',
    '_sonos._tcp.local',
  ],
  PRINTING: [
    '_printer._tcp.local',
    '_ipp._tcp.local',
    '_pdl-datastream._tcp.local',
    '_cups._tcp.local',
  ],
  FILE_SHARING: [
    '_afp._tcp.local',
    '_nfs._tcp.local',
    '_sftp-ssh._tcp.local',
    '_webdav._tcp.local',
  ],
  DEVICE_MGMT: ['_device-info._tcp.local', '_qdiscover._tcp.local', '_scanner._tcp.local'],
  NAS_STORAGE: ['_adisk._tcp.local', '_smb._tcp.local'],
  SECURITY: ['_ssh._tcp.local', '_sftp-ssh._tcp.local', '_https._tcp.local', '_telnet._tcp.local'],
};

/**
 * Complete RFC 2782 service types
 */
export const COMPLETE_RFC2782_SERVICES: string[] = [
  '_http._tcp.local',
  '_https._tcp.local',
  '_ftp._tcp.local',
  '_ssh._tcp.local',
  '_telnet._tcp.local',
  '_smtp._tcp.local',
  '_pop3._tcp.local',
  '_imap._tcp.local',
  '_printer._tcp.local',
  '_ipp._tcp.local',
  '_smb._tcp.local',
  '_afp._tcp.local',
  '_nfs._tcp.local',
  '_workstation._tcp.local',
  '_airplay._tcp.local',
  '_googlecast._tcp.local',
  '_daap._tcp.local',
  '_rtsp._tcp.local',
  '_raop._tcp.local',
  '_vnc._tcp.local',
  '_rdp._tcp.local',
  '_qdiscover._tcp.local',
  '_scanner._tcp.local',
  '_adisk._tcp.local',
];

/**
 * Flatten all services from registry
 */
export const ALL_CATEGORIZED_SERVICES: string[] = Object.values(DNS_SD_SERVICE_REGISTRY).flat();

/**
 * Most common services for efficient scanning
 */
export const COMMON_MDNS_SERVICES: string[] = [
  ...DNS_SD_SERVICE_REGISTRY.CORE,
  ...DNS_SD_SERVICE_REGISTRY.MEDIA,
  ...DNS_SD_SERVICE_REGISTRY.PRINTING,
  ...DNS_SD_SERVICE_REGISTRY.DEVICE_MGMT,
];

/**
 * Service type priorities for performance optimization
 */
const HIGH_PRIORITY: string[] = [
  '_http._tcp.local',
  '_https._tcp.local',
  '_smb._tcp.local',
  '_workstation._tcp.local',
  '_airplay._tcp.local',
  '_googlecast._tcp.local',
  '_qdiscover._tcp.local',
  '_printer._tcp.local',
  '_ipp._tcp.local',
];

const MEDIUM_PRIORITY: string[] = [
  '_ftp._tcp.local',
  '_ssh._tcp.local',
  '_vnc._tcp.local',
  '_rdp._tcp.local',
  '_daap._tcp.local',
  '_rtsp._tcp.local',
  '_nfs._tcp.local',
  '_afp._tcp.local',
];

const LOW_PRIORITY: string[] = COMPLETE_RFC2782_SERVICES.filter(
  (service) => ![...HIGH_PRIORITY, ...MEDIUM_PRIORITY].includes(service),
);

export const SERVICE_PRIORITIES: Record<PriorityLevel, string[]> = {
  HIGH: HIGH_PRIORITY,
  MEDIUM: MEDIUM_PRIORITY,
  LOW: LOW_PRIORITY,
};

/**
 * Get services by category
 */
export function getServicesByCategory(category: ServiceCategory): string[] {
  return DNS_SD_SERVICE_REGISTRY[category] || [];
}

/**
 * Get all available services
 */
export function getAllServices(): string[] {
  return [...new Set([...ALL_CATEGORIZED_SERVICES, ...COMPLETE_RFC2782_SERVICES])];
}

/**
 * Get common services for quick scanning
 */
export function getCommonServices(): string[] {
  return COMMON_MDNS_SERVICES;
}

/**
 * Get services by priority level
 */
export function getServicesByPriority(priority: PriorityLevel): string[] {
  return SERVICE_PRIORITIES[priority] || [];
}

/**
 * Create DNS query questions for services
 */
export function createServiceQuery(services: string[], maxServices = 10): DnsQuestion[] {
  // Limit to prevent UDP packet size issues
  const limitedServices = services.slice(0, maxServices);

  return limitedServices.map((service) => ({
    type: 'PTR',
    name: service,
    class: 'IN',
  }));
}
