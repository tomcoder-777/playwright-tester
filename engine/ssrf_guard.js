/**
 * 🛡️ SSRF Guard
 * The dashboard lets a caller supply an arbitrary URL and then has a real browser fetch,
 * crawl, and click around on it. Hosted publicly, that's an open proxy into whatever network
 * the server sits on — someone could point it at localhost, an internal service, or a cloud
 * metadata endpoint (169.254.169.254) and use the tool's own browser to reach it. This checks
 * a target URL against that risk before any navigation happens, including resolving DNS so a
 * public-looking hostname that actually resolves to a private address (DNS rebinding) is
 * caught too.
 */
const dns = require('dns');
const net = require('net');

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0']);

function ipToLong(ip) {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIPv4(ip) {
  const long = ipToLong(ip);
  const inRange = (base, bits) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (long & mask) === (ipToLong(base) & mask);
  };
  return (
    inRange('10.0.0.0', 8) ||        // RFC1918
    inRange('172.16.0.0', 12) ||     // RFC1918
    inRange('192.168.0.0', 16) ||    // RFC1918
    inRange('127.0.0.0', 8) ||       // loopback
    inRange('169.254.0.0', 16) ||    // link-local — includes cloud metadata (169.254.169.254)
    inRange('100.64.0.0', 10) ||     // CGNAT
    inRange('0.0.0.0', 8)            // "this network"
  );
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  return (
    lower === '::1' ||               // loopback
    lower.startsWith('fe80:') ||     // link-local
    lower.startsWith('fc') || lower.startsWith('fd') || // unique local (fc00::/7)
    lower.startsWith('::ffff:') && isPrivateIPv4(lower.replace('::ffff:', '')) // IPv4-mapped
  );
}

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // Unrecognized format — fail closed
}

async function isTargetUrlSafe(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch (e) {
    return { safe: false, reason: 'Target URL is not a valid, well-formed URL.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: `Protocol "${parsed.protocol}" is not allowed — only http/https targets can be audited.` };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { safe: false, reason: `Hostname "${hostname}" is a local/internal address and cannot be audited.` };
  }

  // WHATWG URL keeps the brackets on an IPv6 literal host ("[::1]") — strip them so the
  // direct-IP check below actually recognizes it instead of falling through to DNS.
  const bareHost = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

  // If the hostname is already a literal IP, check it directly.
  if (net.isIP(bareHost)) {
    if (isPrivateAddress(bareHost)) {
      return { safe: false, reason: `Target IP address "${bareHost}" is in a private/reserved range.` };
    }
    return { safe: true };
  }

  // Otherwise resolve DNS and check every returned address — a hostname can be made to
  // resolve to a private IP (DNS rebinding) even though the hostname itself looks public.
  try {
    const records = await dns.promises.lookup(hostname, { all: true, verbatim: true });
    const privateHit = records.find(r => isPrivateAddress(r.address));
    if (privateHit) {
      return { safe: false, reason: `Hostname "${hostname}" resolves to a private/internal IP address (${privateHit.address}).` };
    }
    if (records.length === 0) {
      return { safe: false, reason: `Hostname "${hostname}" did not resolve to any address.` };
    }
  } catch (e) {
    return { safe: false, reason: `Hostname "${hostname}" could not be resolved: ${e.message}` };
  }

  return { safe: true };
}

module.exports = {
  isTargetUrlSafe
};
