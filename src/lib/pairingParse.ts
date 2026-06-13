import type { PairingPayload } from "../types/protocol";
import { PROTOCOL_VERSION } from "../types/protocol";
import { normalizeLanHost, validatePairingHost } from "./netPolicy";

/** Pull JSON object from QR text (handles stray whitespace / wrappers). */
export function extractPairingJsonText(raw: string): string {
  const trimmed = raw.trim().replace(/^\uFEFF/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

export function parsePairingJson(
  raw: string,
): { ok: true; data: PairingPayload } | { ok: false; error: string } {
  let parsed: unknown;
  const jsonText = extractPairingJsonText(raw);
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {
      ok: false,
      error: "Invalid QR - scan the PC Pair Mobile code, not the Expo dev QR.",
    };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Expected a JSON object." };
  }
  const o = parsed as Record<string, unknown>;
  if (o.v !== PROTOCOL_VERSION) {
    return {
      ok: false,
      error: `Unsupported protocol version (expected ${PROTOCOL_VERSION}).`,
    };
  }
  if (typeof o.host !== "string") return { ok: false, error: "Missing host." };
  const host = normalizeLanHost(o.host);
  if (typeof o.port !== "number" && typeof o.port !== "string") {
    return { ok: false, error: "Missing port." };
  }
  const port = typeof o.port === "number" ? o.port : Number(o.port);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return { ok: false, error: "Invalid port." };
  }
  if (typeof o.key !== "string" || o.key.length < 16) {
    return { ok: false, error: "Missing or invalid key." };
  }
  const hostErr = validatePairingHost(host);
  if (hostErr) return { ok: false, error: hostErr };

  return {
    ok: true,
    data: { v: PROTOCOL_VERSION, host, port, key: o.key.trim() },
  };
}
