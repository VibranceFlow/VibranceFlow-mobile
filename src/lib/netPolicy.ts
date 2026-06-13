/** Allow only RFC1918 and link-local IPv4 (LAN zero-trust boundary). */

function parseIpv4(host: string): number[] | null {
  const parts = host.trim().split(".");
  if (parts.length !== 4) return null;
  const nums: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n < 0 || n > 255) return null;
    nums.push(n);
  }
  return nums;
}

/** Strip IPv6 brackets and reject non-IPv4 hosts for v1 (avoids v4/v6 ambiguity). */
export function normalizeLanHost(host: string): string {
  let h = host.trim();
  if (h.startsWith("[") && h.includes("]")) {
    h = h.slice(1, h.indexOf("]"));
  }
  if (h.includes(":")) {
    return h;
  }
  return h;
}

export function isPrivateLanHost(host: string): boolean {
  const h = normalizeLanHost(host);
  if (h.includes(":")) {
    return false;
  }
  const ip = parseIpv4(h);
  if (!ip) return false;
  const [a, b] = ip;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

export function validatePairingHost(host: string): string | null {
  const h = normalizeLanHost(host);
  if (!h) return "Host is required.";
  if (h.includes(":")) {
    return "Use the PC IPv4 address from Pair Mobile (e.g. 192.168.x.x), not IPv6.";
  }
  if (h === "127.0.0.1" || h === "localhost") {
    return "PC QR shows localhost - fix LAN IP on Windows (reopen Pair Mobile).";
  }
  if (!isPrivateLanHost(h)) {
    return "Only private LAN IPv4 addresses are allowed (e.g. 192.168.x.x).";
  }
  return null;
}
