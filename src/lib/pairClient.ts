import { validatePairingHost } from "./netPolicy";
import {
  PROTOCOL_VERSION,
  DEFAULT_REMOTE_PORT,
  type PairingPayload,
} from "../types/protocol";

const PAIR_TIMEOUT_MS = 12_000;

type PairResponse = {
  v?: number;
  ok?: boolean;
  host?: string;
  port?: number;
  key?: string;
  error?: string;
};

export function normalizePinInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6);
}

export function validatePinInput(pin: string): string | null {
  const digits = normalizePinInput(pin);
  if (digits.length !== 6) {
    return "Enter the 6-digit code shown on the PC (Pair Mobile).";
  }
  return null;
}

/** Exchange PIN for Fernet key over plaintext WS (LAN only, one-shot). */
export function pairWithPin(
  host: string,
  port: number,
  pin: string,
): Promise<PairingPayload> {
  const hostErr = validatePairingHost(host);
  if (hostErr) return Promise.reject(new Error(hostErr));
  const pinErr = validatePinInput(pin);
  if (pinErr) return Promise.reject(new Error(pinErr));
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return Promise.reject(new Error("Invalid port."));
  }

  const digits = normalizePinInput(pin);
  const url = `ws://${host.trim()}:${port}`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let settled = false;

    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(new Error(msg));
    };

    const timer = setTimeout(
      () => fail("Connection timed out. Is Pair Mobile open on the PC?"),
      PAIR_TIMEOUT_MS,
    );

    ws.onerror = () =>
      fail("Could not reach the PC. Check IP, Wi‑Fi, and Pair Mobile.");
    ws.onclose = () => {
      if (!settled) fail("Connection closed before pairing completed.");
    };

    ws.onopen = () => {
      ws.send(
        JSON.stringify({ v: PROTOCOL_VERSION, cmd: "pair", pin: digits }),
      );
    };

    ws.onmessage = (ev) => {
      if (settled) return;
      let body: PairResponse;
      try {
        body = JSON.parse(String(ev.data)) as PairResponse;
      } catch {
        fail("Invalid response from PC.");
        return;
      }
      if (body.v !== PROTOCOL_VERSION) {
        fail(`Unsupported protocol version (expected ${PROTOCOL_VERSION}).`);
        return;
      }
      if (body.error === "too_many_attempts") {
        fail("Too many wrong codes. Wait about 60 seconds, then try again.");
        return;
      }
      if (!body.ok || typeof body.key !== "string" || body.key.length < 16) {
        fail(body.error ?? "Invalid or expired code.");
        return;
      }
      const outHost = typeof body.host === "string" ? body.host : host;
      const outPort = typeof body.port === "number" ? body.port : port;
      const hostCheck = validatePairingHost(outHost);
      if (hostCheck) {
        fail(hostCheck);
        return;
      }
      settled = true;
      clearTimeout(timer);
      ws.close();
      resolve({
        v: PROTOCOL_VERSION,
        host: outHost.trim(),
        port: outPort,
        key: body.key.trim(),
      });
    };
  });
}

export { DEFAULT_REMOTE_PORT };
