/**
 * IP Address Utilities
 * 
 * Functions for IP address validation and classification.
 */

/**
 * Check if an IP address is private (RFC 1918)
 * Private IP ranges:
 * - 10.0.0.0/8 (10.0.0.0 - 10.255.255.255)
 * - 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
 * - 192.168.0.0/16 (192.168.0.0 - 192.168.255.255)
 * - 127.0.0.0/8 (loopback)
 * - 169.254.0.0/16 (link-local)
 */
export function isPrivateIP(ip: string): boolean {
  // Parse IP address
  const parts = ip.split('.').map(Number);

  // Validate it's a proper IPv4 address
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return false; // Invalid IP, treat as non-private
  }

  const [octet1, octet2] = parts;

  // Check all private IP ranges
  return (
    octet1 === 10 || // 10.0.0.0/8
    (octet1 === 172 && octet2 >= 16 && octet2 <= 31) || // 172.16.0.0/12
    (octet1 === 192 && octet2 === 168) || // 192.168.0.0/16
    octet1 === 127 || // 127.0.0.0/8 (loopback)
    (octet1 === 169 && octet2 === 254) // 169.254.0.0/16 (link-local)
  );
}

