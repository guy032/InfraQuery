// ============= Common Types =============

export interface PortLookup {
  [port: string]: string | null;
}

// ============= Ping Types =============

export interface PingResult {
  alive: boolean;
  latency: number | null;
}

export interface PingSweepOptions {
  timeout?: number;
  concurrency?: number;
  retries?: number;
  onFound?: (ip: string, result: PingResult) => void;
}

export interface PingSweepResults {
  [ip: string]: PingResult;
}

// ============= TCP Scan Types =============

export interface TCPScanOptions {
  onFound?: (ip: string, port: number) => void;
}

export interface TCPScanResults {
  [ip: string]: number[];
}

export interface NaabuConfig {
  host: string;
  s: string;
  iv: number;
  interface: string | null;
  'source-ip': string | null;
  wn: boolean;
  c: number;
  rate: number;
  retries: number;
  timeout: number;
  stream: boolean;
  json: boolean;
}

export interface NaabuResult {
  ip: string;
  port: number;
}

// ============= UDP Scan Types =============

export interface UDPPortInfo {
  port: number;
  service: string;
}

export interface UDPScanOptions {
  timeout?: number;
  concurrency?: number;
  retries?: number;
  onFound?: (ip: string, portInfo: UDPPortInfo) => void;
}

export interface UDPScanResults {
  [ip: string]: UDPPortInfo[];
}

export interface UdpzResult {
  host?: {
    host?: string;
  } | string;
  port: number;
  service?: {
    slug?: string;
  };
  probe?: {
    slug?: string;
  };
}

// ============= UDP Extra Scan Types =============

export interface UDPExtraPortInfo {
  port: number;
  service: string;
  protocol: string;
  details?: {
    locations?: string[];
    [key: string]: any;
  };
}

export interface UDPExtraScanOptions {
  timeout?: number;
  concurrency?: number;
  onFound?: (ip: string, portInfo: UDPExtraPortInfo) => void;
}

export interface UDPExtraScanResults {
  [ip: string]: UDPExtraPortInfo[];
}

// ============= Main Application Types =============

export interface HostInfo {
  ping: {
    alive: boolean;
    latency?: number;
  };
  ports: {
    tcp: { [port: string]: string | null };
    udp: { [port: string]: string | null };
  };
  hostname?: string;
  adapters?: { [protocol: string]: any };
}

export interface PerformanceMetrics {
  startTime: number | null;
  endTime: number | null;
  duration: string | null;
  hostsFound?: number;
  portsFound?: number;
  hostsWithPorts?: number;
  rate?: string;
}

export interface Results {
  hosts: { [ip: string]: HostInfo };
  startTime: number;
  endTime: number | null;
  duration?: string;
  performance: {
    ping: PerformanceMetrics & { hostsFound: number };
    tcp: PerformanceMetrics & { portsFound: number; hostsWithPorts: number };
    udp: PerformanceMetrics & { portsFound: number; hostsWithPorts: number };
    udpExtra: PerformanceMetrics & { portsFound: number; hostsWithPorts: number };
  };
}

export interface LatencyStatistics {
  min: number;
  max: number;
  avg: number;
}

export interface FinalResults {
  subnet: string;
  duration: string;
  summary: {
    totalHosts: number;
    aliveHosts: number;
    hostsWithTCPPorts: number;
    hostsWithUDPPorts: number;
    totalTCPPorts: number;
    totalUDPPorts: number;
  };
  latency: LatencyStatistics | null;
  performance: {
    ping: {
      duration: string | null;
      hostsFound: number;
      rate: string;
    };
    tcp: {
      duration: string | null;
      portsFound: number;
      hostsWithPorts: number;
      rate: string;
    };
    udp: {
      duration: string | null;
      portsFound: number;
      hostsWithPorts: number;
      rate: string;
    };
  };
  hosts: { [ip: string]: HostInfo };
  traverser?: {
    duration: string;
    hostsProcessed: number;
  };
}
