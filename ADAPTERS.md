# Protocol Adapters Status

## Currently Active

### SNMP (✅ Working)
- **Dependencies**: `net-snmp`, `asn1.js` (installed)
- **Protocols**: SNMPv1, SNMPv2c, SNMPv3
- **Status**: Fully functional with parallel version detection
- **Discovery Strategy**: 
  - Tries all 3 versions simultaneously (v2c, v1, v3)
  - Returns best result with priority: v2c > v1 > v3
  - v3 performs discovery only (USM Security Parameters extraction)
- **What it does**: 
  - Queries SNMP agents to collect device information, OIDs, vendor-specific data
  - For SNMPv1/v2c: Full device enumeration with 418+ OIDs
  - For SNMPv3: Engine ID, enterprise number, boot time (no authentication)

## Disabled (Missing Dependencies)

To enable these adapters, install the required npm packages:

### BACnet
- **Dependencies needed**: `bacstack`
- **Install**: `npm install bacstack`
- **Protocol**: Building Automation and Control Networks

### CIP/EtherNet/IP  
- **Dependencies needed**: `st-ethernet-ip`
- **Install**: `npm install st-ethernet-ip`
- **Protocol**: Common Industrial Protocol

### DNS
- **Dependencies needed**: Additional packages (check adapter code)
- **Protocol**: Domain Name System queries

### HTTP/HTTPS
- **Dependencies needed**: Additional packages (check adapter code)
- **Protocol**: Web server discovery and information gathering

### mDNS
- **Dependencies needed**: `dns-packet`, `bplist-parser`
- **Install**: `npm install dns-packet bplist-parser`
- **Protocol**: Multicast DNS / Bonjour / Zeroconf

### Modbus
- **Dependencies needed**: Additional packages (check adapter code)
- **Protocol**: Modbus industrial protocol

### OPC UA
- **Dependencies needed**: Additional packages (check adapter code)
- **Protocol**: OPC Unified Architecture

### Prometheus
- **Dependencies needed**: Additional packages (check adapter code)
- **Protocol**: Prometheus metrics endpoint

### S7comm
- **Dependencies needed**: Additional packages (check adapter code)
- **Protocol**: Siemens S7 communication

### SIP
- **Dependencies needed**: Additional packages (check adapter code)
- **Protocol**: Session Initiation Protocol (VoIP)

### SSH
- **Dependencies needed**: Additional packages (check adapter code)
- **Protocol**: Secure Shell

### UPnP/SSDP
- **Dependencies needed**: `axios`, `xml2js`
- **Install**: `npm install axios xml2js`
- **Protocol**: Universal Plug and Play / Simple Service Discovery Protocol

### WSD (Web Services Discovery)
- **Dependencies needed**: `uuid`, `soap`
- **Install**: `npm install uuid soap`
- **Protocol**: WS-Discovery, WS-Transfer (printers, cameras, etc.)

### WS-Management / WinRM
- **Dependencies needed**: `ntlm-parser`
- **Install**: `npm install ntlm-parser`
- **Protocol**: Windows Remote Management

## How to Enable More Adapters

1. Install the required dependencies for the adapter you want
2. Edit `src/lib/traverser/adapter/index.ts` and uncomment the adapter export
3. Edit `tsconfig.json` and remove the adapter from the exclude list
4. Run `npm run build`
5. Test the scanner

## Current Configuration

The scanner is configured to:
- Use **only SNMP adapter** (the only one with all dependencies installed)
- Gracefully skip services that don't have available adapters
- Continue scanning even if some adapters fail

When you run the scanner, you'll see adapter results under the `adapters` key for each host that has SNMP enabled.
