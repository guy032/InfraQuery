/**
 * TypeScript type definitions for mDNS protocol
 */

/**
 * Common device information structure
 */
export interface DeviceInfo {
  services: Record<string, ServiceData>;
  hostname: string | null;
  manufacturer: string | null;
  model: string | null;
  fullServiceData?: FullServiceData;
}

/**
 * Generic service data structure
 */
export interface ServiceData {
  name: string;
  port: number;
  protocol: string;
  addresses: string[];
  [key: string]: any;
}

/**
 * Full service data including specialized services
 */
export interface FullServiceData {
  airplay?: AirPlayInfo;
  chromecast?: ChromecastInfo;
}

/**
 * HTTP service parsed data
 */
export interface HttpServiceData extends ServiceData {
  path?: string;
  unitname?: string;
  serialnumber?: string;
  unitnamingmethod?: string;
  unitdescription?: string;
  functionality?: string;
  vendor?: string;
  model?: string;
  manufacturer?: string;
  version?: string;
  hostname?: string;
  serial?: string;
}

/**
 * QDiscover (QNAP) service parsed data
 */
export interface QDiscoverServiceData extends ServiceData {
  accessType?: string;
  accessPort?: string;
  model?: string;
  displayModel?: string;
  fwVer?: string;
  fwBuildNum?: string;
  vendor?: string;
  manufacturer?: string;
  version?: string;
  hostname?: string;
  serial?: string;
}

/**
 * Chromecast service data from mDNS TXT records
 */
export interface ChromecastTxtData {
  id?: string;
  md?: string; // Model
  fn?: string; // Friendly name
  rs?: string; // Receiver state
  bs?: string; // Boot state
  st?: string; // Setup state
  ca?: string; // Capabilities
  ic?: string; // Icon path
}

/**
 * Chromecast device information
 */
export interface ChromecastInfo {
  Name: string;
  Address: string;
  Port: number;
  Model?: string;
  Manufacturer?: string;
  Version?: string;
  MacAddress?: string;
  DeviceId?: string;
}

/**
 * Chromecast query result
 */
export interface ChromecastResult {
  chromecast: {
    services: Record<string, ChromecastInfo>;
  };
  serviceType: 'chromecast';
}

/**
 * AirPlay service data from mDNS TXT records
 */
export interface AirPlayTxtData {
  deviceid?: string;
  model?: string;
  srcvers?: string;
  features?: string;
  flags?: string;
  pi?: string; // MAC address
  vv?: string; // Volume
  am?: string; // Audio model
  md?: string; // Model
  cn?: string; // Computer name
  tp?: string; // Transport
}

/**
 * Complete AirPlay device information
 */
export interface AirPlayInfo {
  Name: string;
  Address: string;
  Port: number;
  Server: string;
  DeviceModel: string;
  AirPlayVersion: string;
  DeviceId: string;
  MacAddress: string;
  ProtocolVersion: string;
  Features: string;
  SenderAddress: string;
  PublicKey: string;
  PSI: string;
  PairingIdentifier: string;
  Manufacturer: string;
  Integrator: string;
  SerialNumber: string;
  FirmwareRevision: string;
  FirmwareBuildDate: string;
  HardwareRevision: string;
  OperatingSystem: string;
  BuildVersion: string;
  OSBuildVersion: string;
  SDK: string;
  PTPInfo: string;
  StatusFlags: number | null;
  VolumeControlType: number | null;
  ActiveInterfaceType: number | null;
  NameIsFactoryDefault: boolean | null;
  KeepAliveLowPower: boolean | null;
  KeepAliveSendStatsAsBody: boolean | null;
  AudioLatencies: any;
  AudioFormats: any;
  SupportedAudioFormatsExtended: any;
  SupportedFormats: any;
  PlaybackCapabilities: any;
  Displays: any;
  ReceiverHDRCapability: string;
  CanRecordScreenStream: boolean | null;
  Volume: string | null;
  VolumeSupported: any;
  InitialVolume: number | null;
  ScreenDemoMode: boolean | null;
  FeaturesEx: string;
}

/**
 * AirPlay query result
 */
export interface AirPlayResult {
  airplay: {
    services: Record<string, AirPlayInfo>;
  };
  serviceType: 'airplay';
}

/**
 * Service configuration
 */
export interface ServiceConfig {
  query: string;
  defaultPort: number;
  directConnection: ((targetIp: string) => Promise<any>) | null;
}

/**
 * mDNS discovery options
 */
export interface MdnsDiscoveryOptions {
  timeout?: number;
}

/**
 * Device metadata for metrics
 */
export interface DeviceMetadata {
  hostname?: string;
  manufacturer?: string;
  model?: string;
  services?: string;
  serviceCount: number;
  airplay?: AirPlayInfo;
  chromecast?: ChromecastInfo;
}

/**
 * Telegraf metric format
 */
export interface TelegrafMetric {
  fields: Record<string, number | string>;
  name: string;
  tags: Record<string, string>;
  timestamp: number;
}

/**
 * Direct connection results
 */
export interface DirectConnectionResults {
  services: Record<string, ServiceData>;
  manufacturer: string | null;
  model: string | null;
  hostname: string | null;
  fullServiceData: FullServiceData;
}

/**
 * Service instance data
 */
export interface ServiceInstance {
  port: number | null;
  target: string | null;
  txtData: Record<string, string>;
  serviceType: string;
}

/**
 * DNS Question
 */
export interface DnsQuestion {
  type: string;
  name: string;
  class: string;
}

/**
 * DNS Query packet
 */
export interface DnsQuery {
  type: 'query';
  id: number;
  flags: number;
  questions: DnsQuestion[];
}
