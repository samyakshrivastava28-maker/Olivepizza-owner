/**
 * SSRFValidator.ts — Server-Side Request Forgery & Hostname Protection
 *
 * Validates connection URIs and API endpoints for Data Manager custom database integrations.
 * Strictly blocks:
 *  - Loopback addresses (127.0.0.1, localhost, ::1)
 *  - Cloud metadata endpoints (169.254.169.254, metadata.google.internal, etc.)
 *  - RFC 1918 Private IP blocks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 *  - Link-local and multicast ranges
 *  - Non-HTTP/HTTPS/PostgreSQL/MongoDB protocols unless explicitly allowed
 */

import net from 'net';
import { URL } from 'url';

export class SSRFValidator {
  private static BLOCKED_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    '0.0.0.0',
    '169.254.169.254',
    'metadata.google.internal',
    'metadata.aws.internal',
    'instance-data',
    '100.100.100.200', // Alibaba metadata
  ]);

  /**
   * Validates whether a target URL/URI is safe to connect to.
   * Returns { safe: true } or { safe: false, reason: string }.
   */
  public static validate(targetUrl: string, allowedSchemes: string[] = ['http:', 'https:', 'postgresql:', 'postgres:', 'mongodb:', 'mongodb+srv:', 'redis:', 'rediss:']): { safe: boolean; reason?: string } {
    if (!targetUrl || typeof targetUrl !== 'string') {
      return { safe: false, reason: 'Empty or invalid URL provided.' };
    }

    const trimmed = targetUrl.trim();

    // Fast check for special keywords
    for (const blocked of this.BLOCKED_HOSTS) {
      if (trimmed.toLowerCase().includes(blocked)) {
        return { safe: false, reason: `Access to restricted internal/metadata host "${blocked}" is strictly blocked for security.` };
      }
    }

    try {
      // Normalize URL format
      let parsedUrl: URL;
      if (trimmed.includes('://')) {
        parsedUrl = new URL(trimmed);
      } else {
        parsedUrl = new URL(`https://${trimmed}`);
      }

      // Check scheme
      if (!allowedSchemes.includes(parsedUrl.protocol)) {
        return {
          safe: false,
          reason: `Protocol "${parsedUrl.protocol}" is not allowed. Allowed protocols: ${allowedSchemes.join(', ')}`,
        };
      }

      const hostname = parsedUrl.hostname.toLowerCase();

      // Check blocked hostnames
      if (this.BLOCKED_HOSTS.has(hostname)) {
        return { safe: false, reason: `Access to restricted host "${hostname}" is blocked.` };
      }

      // Check IP addresses
      if (net.isIP(hostname)) {
        if (this.isPrivateOrLoopbackIP(hostname)) {
          return { safe: false, reason: `Direct access to private or loopback IP "${hostname}" is forbidden.` };
        }
      }

      return { safe: true };
    } catch (err: any) {
      return { safe: false, reason: `URL parsing failed: ${err.message}` };
    }
  }

  private static isPrivateOrLoopbackIP(ip: string): boolean {
    // IPv4 checks
    if (net.isIPv4(ip)) {
      const parts = ip.split('.').map(Number);
      const [first, second] = parts;

      // 127.0.0.0/8 (Loopback)
      if (first === 127) return true;

      // 0.0.0.0/8 (Current network)
      if (first === 0) return true;

      // 10.0.0.0/8 (Private network)
      if (first === 10) return true;

      // 172.16.0.0/12 (Private network)
      if (first === 172 && second >= 16 && second <= 31) return true;

      // 192.168.0.0/16 (Private network)
      if (first === 192 && second === 168) return true;

      // 169.254.0.0/16 (Link-local & AWS/GCP metadata)
      if (first === 169 && second === 254) return true;

      // 224.0.0.0/4 (Multicast)
      if (first >= 224 && first <= 239) return true;
    }

    // IPv6 checks
    if (net.isIPv6(ip)) {
      const lower = ip.toLowerCase();
      if (lower === '::1' || lower === '::') return true;
      if (lower.startsWith('fe80:')) return true; // Link-local
      if (lower.startsWith('fc00:') || lower.startsWith('fd00:')) return true; // Unique local
    }

    return false;
  }
}
