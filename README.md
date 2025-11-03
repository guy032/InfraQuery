> ⭐️ Star InfraQuery to support open-source agentless discovery and help us ship new integrations faster!

![GitHub Repo stars](https://img.shields.io/github/stars/maprixcom/infraquery)

<img width="1458" height="772" alt="image (59)" src="https://github.com/user-attachments/assets/27159656-5452-416e-a6a9-a82fd2036cf0" />
<img width="1703" height="1323" alt="image" src="https://github.com/user-attachments/assets/a48f656c-c3d0-46bc-b2cc-d40dc4a4debd" />
<img width="1711" height="1318" alt="image" src="https://github.com/user-attachments/assets/821d2df6-48b3-4699-b6d9-edc8f24e63a9" />

🧭 InfraQuery

### 🧠 Unified Extraction Data Layer

**InfraQuery** is an **open-source framework** that knows how to **discover, extract, and collect data** from any connected environment — spanning **IT, OT, IoT, Cloud, and SaaS**.  
It automatically maps infrastructure and services into a **single, unified extraction layer**, providing the foundation for analytics, monitoring, and AI-driven insights across all systems — from on-prem devices to cloud-native APIs.

This layer is designed to be **agentless, extensible, and protocol-agnostic**, with native support for network and industrial protocols (SNMP, WMI/WinRM, Modbus, BACnet, ONVIF, MQTT, and more).

Our goal is to make infrastructure data **open, composable, and universally accessible** — empowering developers and organizations to build smarter, more connected operational intelligence solutions.

---

## 🚀 Key Features

- **Agentless Discovery** – No agents or installers required; discover all connected devices instantly.  
- **Multi-Protocol Support** – SNMP, Modbus, ONVIF, WMI, Prometheus, BACnet, HTTP, and more.  
- **Device Fingerprinting** – Identify vendor, model, system type, and capabilities automatically.  
- **Topology Traversal** – Explore networks and subnets intelligently using adaptive scanning.  
- **Unified Data Model** – Output structured, semantic data for analytics or integration.  
- **Extensible Design** – Add or customize protocol modules easily.  

---

## 🧩 Use Cases

- Build unified infrastructure inventory across IT, IoT, and OT networks.  
- Feed monitoring systems (Prometheus, Grafana, Zabbix, etc.) with real-time device data.  
- Power analytics and predictive maintenance platforms.  
- Replace fragmented discovery tools with one agentless extraction layer.  

---

⚙️ Getting Started
1. Clone the repository
```
git clone https://github.com/maprixcom/InfraQuery.git
cd infraquery
```
2. Run discovery

Example (CLI or Node.js API):
```
infraquery scan --subnet 192.168.0.0/24
```
3. Output

InfraQuery produces structured JSON:
```
{
  "192.168.0.10": {
    "vendor": "Canon",
    "type": "printer",
    "protocols": ["SNMP", "HTTP"],
    "metrics": {
      "sysName": "Canon-iR-ADV",
      "tonerLevel": 74
    }
  }
}
```
---

🧠 Architecture Overview

InfraQuery is designed as a modular extraction engine, built to unify multi-protocol data from diverse device ecosystems.
```
┌──────────────────────┐
│   Network Scanner    │  → discovers reachable hosts
└─────────┬────────────┘
          │
┌─────────▼────────────┐
│  Protocol Traversal  │  → SNMP, ONVIF, Modbus, WMI, Prometheus...
└─────────┬────────────┘
          │
┌─────────▼────────────┐
│  Semantic Mapper     │  → fingerprints & normalizes data
└─────────┬────────────┘
          │
┌─────────▼────────────┐
│   Unified Output     │  → JSON / API / File export
└──────────────────────┘
```

🌍 Integration Examples
| Platform           | Use                      | Example                          |
| ------------------ | ------------------------ | -------------------------------- |
| **Prometheus**     | Feed custom exporters    | `/metrics` endpoint support      |
| **Grafana**        | Visualization dashboards | Unified device data              |
| **Maprix Cloud**   | SaaS aggregation layer   | Advanced analytics & correlation |
| **Custom Scripts** | Local data enrichment    | JSON exports and APIs            |

## ⚙️ Supported UDP Services

| Service Name | Port(s) | Service Name | Port(s) |
|---------------|----------|---------------|----------|
| Apple Remote Desktop (ARD) | 3283 | Building Automation & Control Networks (BACNet) | 47808 |
| BitTorrent Distributed Hash Table (DHT) | 6881 | Character Generator Protocol | 19 |
| Connectionless Lightweight Directory Access Protocol (CLDAP) | 389 | Constrained Application Protocol (CoAP) | 5683, 5684 |
| IBM-DB2 | 523 | Distributed Network Protocol 3 (DNP3) | 20000 |
| Domain Name System (DNS) | 53 | Datagram Transport Layer Security (DTLS) | 443, 2221, 3391, 4433, 5061, 5349, 10161 |
| EtherNet/IP | 44818, 2222 | Factory Interface Network Service (FINS) | 9600 |
| Highway Addressable Remote Transducer Protocol | 5094 | HID Discovery Protocol | 4070 |
| Internet Key Exchange (IKE) | 500, 4500 | Intelligent Platform Management Interface (IPMI) | 623 |
| Kerberos Key Distribution Center (KDC) | 88 | KNXNet/IP (Konnex) | 3671 |
| Layer 2 Tunneling Protocol (L2TP) | 1701, 1702 | Lantronix Discovery | 30718 |
| Multicast Domain Name System (mDNS) | 5353 | Mitsubishi MELSEC-Q | 5006, 5001, 5007 |
| Memcache | 11211 | Modbus over UDP | 502 |
| Moxa NPort | 4800, 4001 | MQTT-SN Discovery | 1884, 1885 |
| Microsoft Windows RPC (MSRPC) | 135 | Microsoft SQL Server (MSSQL) | 1434 |
| NAT Port Mapping Protocol (NAT-PMP) | 5351 | NetBIOS | 137 |
| Network File System (NFS) | 2049 | Network Time Protocol (NTP) | 123 |
| OpenVPN (VPN) | 1194 | Symantec PCAnywhere | 5632 |
| PCWorx | 1962 | Sun Remote Procedure Call (RPC) | 111 |
| PROFInet Context Manager | 34964 | Quote of the Day (QOTD) | 17 |
| RADIUS | 1812, 1645, 1813 | Remote Desktop Protocol (RDP) over UDP | 3389 |
| Routing Information Protocol (RIP) | 520 | Routing Information Protocol Next Gen (RIPng) | 521 |
| Session Initiation Protocol (SIP) | 5060, 5061, 2543 | Service Location Protocol (SLP) | 427 |
| Simple Network Management Protocol (SNMP) | 161, 162, 6161, 8161, 10161, 10162, 11161 | Session Traversal Utilities for NAT (STUN) | 3478, 3470, 19302, 1990 |
| Trivial File Transfer Protocol (TFTP) | 69, 247, 6969 | Ubiquiti AirControl Discovery Protocol | 10001 |
| Universal Plug and Play (UPnP) | 1900, 5000, 62078 | VxWorks Wind Debug Agent ONCRPC | 17185 |
| Citrix WinFrame Remote Desktop Server | 1604 | Web Services Discovery (WSD) | 3702 |
| X Display Manager Control Protocol (XDMCP) | 177 |  |  |

## ⚙️ Supported TCP Services

| Service | Port(s) | Service | Port(s) | Service | Port(s) |
|----------|----------|----------|----------|----------|----------|
| activemq | 2455, 61616 | adb | 5554 | afp | 5858 |
| ajp | 8009, 16010 | ansys | 8020 | api | 8728 |
| appleAdmin | 3551 | appleRemote | 3283 | appletalk | 19000 |
| asMapper | 16401 | bacnet | 47808 | beanstalkd | 11300 |
| beep | 1177 | bitcoin | 8333 | bmcRemedy | 7170 |
| cadkey | 1400 | cassandra | 2008 | checkpoint | 264 |
| ciscoSmartInstall | 4786 | ciscoTms | 7548 | ST-Link GDB | 61234 |
| cobra | 4282 | conf | 8188 | consul | 9083 |
| couchdb | 5984, 8098 | cpPanel | 2082 | cpPanelSsl | 2083 |
| cpPanelWhm | 2086, 2096 | ctiqbe | 11112 | cwmp | 7547 |
| darkcomet | 1604 | dbms | 2628 | dellOpenmanage | 23424 |
| denoc | 2761 | dlsw | 2067 | dlip | 28015 |
| dns | 53, 4505, 10936, 12117 | dnscrypt | 7100 | dnsTls | 8011, 44818 |
| dockerApi | 9761 | dockerSwarm | 2376 | dnp | 20000 |
| elasticsearch | 9200, 9300 | ethereum | 6080 | exec | 512 |
| filemaker | 8060, 10011 | filezilla | 771 | firebird | 3050 |
| finger | 79 | ftp | 21, 22000 | ftpAlt | 2121 |
| ftpData | 42235 | ftps | 8686 | git | 9418 |
| globalCatalog | 3268 | globalCatalogSsl | 3269 | graphite | 2003 |
| hadoop | 50050 | hbase | 7634 | http | 80, 2554, 30003, 4243, 5443 |
| httpAlt | 81, 3000, 2375, 8080, 8081 | httpProxy | 3128, 8010, 8090 | https | 443, 4443, 9074, 9443 |
| httpsAlt | 4433, 8443, 10443 | ibmMq | 25672 | iclConection | 10003 |
| iclTwobase | 25001 | ident | 113, 1153 | iec104 | 2404 |
| imap | 143, 7172, 8194, 8607 | imaps | 451, 993, 9194, 18064 | intelAmt | 19071, 60129 |
| interwise | 7779 | ipp | 631 | ipmi | 623 |
| ipsec | 4500, 7171 | irc | 6668, 58603 | ircSsl | 1515 |
| iscsi | 3260 | isoTsap | 2081 | itunes | 28017 |
| javaRmi | 8015 | kafka | 9092 | kerberos | 88 |
| kubelet | 10250 | kubernetes | 6443, 35000 | knx | 3671 |
| ldaps | 636, 10554 | ldp | 7050 | l2tp | 1701 |
| lpd | 515 | mdns | 5000, 5353, 7000 | membase | 11210 |
| memcached | 11211 | miniduke | 13579 | mitDevice | 83 |
| mongodb | 27017 | mongodbWeb | 11371 | modbus | 502 |
| moxa | 4800 | mqseries | 1414 | mqtt | 1883 |
| msWbt | 3391 | msmq | 4434 | mssql | 1433, 1434, 4022 |
| msrpc | 135 | munin | 11000 | mysql | 3306, 8889 |
| mysqlX | 33060 | neo4j | 7474 | nessus | 8834 |
| netbios | 139, 2323, 19233 | netop | 1970 | netscape | 10909, 10911 |
| netscout | 8112 | nntp | 119 | nrpe | 7730 |
| ntp | 123 | odoo | 8069 | omaDcd | 626 |
| openflow | 789 | openvpn | 1194 | opcua | 4840 |
| oracle | 1521, 9530 | oracleHttps | 7443 | oracleRdbms | 3301 |
| oracleSsl | 1522 | oracleWebcenter | 16030 | pcanywhere | 5632, 54321 |
| pervasive | 8545 | pgpKeyserver | 6060 | pichat | 9009 |
| polipo | 32400 | pop3 | 110, 7085, 7601, 8156 | pop3s | 995, 18102, 21309 |
| postgresql | 5432, 5901 | prometheus | 9100, 9143 | puppet | 8140 |
| rabbitmq | 15672 | radius | 1812 | radmin | 4040 |
| rdp | 3389, 9221, 16083 | redis | 6379 | remoteAnything | 21025 |
| remoteWhois | 4321 | rsync | 873 | rtmp | 1935 |
| rtsp | 554 | rtspAlt | 8554 | saltstack | 9981 |
| sap | 3299 | scol | 11, 1200 | scp | 10001 |
| sccp | 2000 | sercomm | 32764 | smtp | 25, 587, 1494, 5609 |
| smtps | 465, 833, 5613, 12545 | smb | 445 | snmp | 161, 3522, 5916, 8871 |
| socks | 1080 | sphinx | 9306 | splunk | 8089 |
| ssh | 22, 12122, 29842 | sshAlt | 2222 | steam | 27015 |
| stun | 3478 | svn | 44336 | syncthing | 4100 |
| teamviewer | 62078 | telnet | 23 | telnetGateway | 8591 |
| tivoliFramework | 50000 | tor | 8705 | torBrowser | 9151 |
| torControl | 9051 | torOrport | 9001 | tr069 | 4567 |
| trap | 55554 | tridium | 60001 | uucp | 541 |
| vesta | 8083 | veeam | 9160 | virtualbox | 8007 |
| vnc | 5900, 5910, 10049, 11288, 20090 | vncHttp | 4949, 5801 | voip | 3784 |
| vxworks | 17185 | webdav | 9633 | webmin | 10000 |
| websnp | 8084 | whois | 43, 8126 | winbox | 8291 |
| wme | 5007 | wsman | 104, 5985 | wsmanSsl | 5986 |
| wsd | 3702, 8500, 9091 | x11 | 6000, 6001 | xWindow | 5435 |
| xmpp | 2095, 5222 | xmppS2s | 5269 | zabbix | 400, 10050 |
| zimbra | 9095 |  |  |  |  |

