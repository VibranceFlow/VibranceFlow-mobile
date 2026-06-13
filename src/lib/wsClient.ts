import { encryptJson, decryptJson } from "./fernetWire";
import { devLog, redactHostPort } from "./redact";
import { isPrivateLanHost } from "./netPolicy";
import type {
  RemoteCommand,
  RemoteRequest,
  RemoteResponse,
} from "../types/protocol";
import { PROTOCOL_VERSION } from "../types/protocol";

export type DisconnectReason = "port_closed" | "lost";

function randomId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function serializeRequest(req: RemoteRequest): string {
  return JSON.stringify(req);
}

function isPortClosedFrame(resp: RemoteResponse): boolean {
  return resp.event === "port_closed" || resp.error === "port_closed";
}

export class VibranceFlowWsClient {
  private ws: WebSocket | null = null;
  private key = "";
  private pending = new Map<
    string,
    { resolve: (r: RemoteResponse) => void; reject: (e: Error) => void }
  >();
  private disconnectReason: DisconnectReason | null = null;

  onDisconnect: ((reason: DisconnectReason) => void) | null = null;

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(host: string, port: number, key: string): Promise<void> {
    if (!isPrivateLanHost(host)) {
      return Promise.reject(new Error("Host is not a private LAN address."));
    }
    this.key = key.trim();
    this.disconnectReason = null;
    this.disconnect();

    return new Promise((resolve, reject) => {
      const url = `ws://${host.trim()}:${port}`;
      devLog("connecting", { target: redactHostPort(host, port) });
      const ws = new WebSocket(url);
      this.ws = ws;
      let settled = false;

      const fail = (msg: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        reject(new Error(msg));
      };

      const timeout = setTimeout(
        () =>
          fail(
            "Connection timed out. Keep VibranceFlow open on the PC and allow it in Windows Firewall.",
          ),
        15_000,
      );

      ws.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve();
      };
      ws.onerror = () => {
        fail("WebSocket error. Is VibranceFlow running on the PC?");
      };
      ws.onclose = () => {
        if (!settled) {
          fail("Could not reach the PC. Check firewall and same Wi‑Fi.");
          return;
        }
        const reason = this.disconnectReason ?? "lost";
        this.disconnectReason = null;
        this.rejectAllPending(
          new Error(
            reason === "port_closed"
              ? "PC closed remote port (8765)."
              : "Disconnected from PC.",
          ),
        );
        this.onDisconnect?.(reason);
      };
      ws.onmessage = (ev) => {
        try {
          const wire = typeof ev.data === "string" ? ev.data : String(ev.data);
          const plain = decryptJson(this.key, wire);
          const resp = JSON.parse(plain) as RemoteResponse;
          if (isPortClosedFrame(resp)) {
            this.disconnectReason = "port_closed";
            return;
          }
          const id = resp.id;
          if (id && this.pending.has(id)) {
            const p = this.pending.get(id)!;
            this.pending.delete(id);
            p.resolve(resp);
            return;
          }
          if (resp.ok === false && resp.error === "unauthorized") {
            const err = new Error(
              "Encryption key mismatch. On the PC do not click New code while paired. Re-pair with a fresh QR or 6-digit code.",
            );
            this.rejectOnePending(err);
          }
        } catch {
          devLog("ignored frame");
        }
      };
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.rejectAllPending(new Error("Disconnected."));
  }

  private rejectAllPending(err: Error): void {
    for (const p of this.pending.values()) {
      p.reject(err);
    }
    this.pending.clear();
  }

  private rejectOnePending(err: Error): void {
    const first = this.pending.entries().next();
    if (!first.done) {
      first.value[1].reject(err);
      this.pending.delete(first.value[0]);
    }
  }

  sendCommand(
    cmd: RemoteCommand,
    payload?: Record<string, unknown>,
  ): Promise<RemoteResponse> {
    if (!this.connected || !this.ws) {
      return Promise.reject(new Error("Not connected. Re-pair with the PC."));
    }
    const id = randomId();
    const req: RemoteRequest = { v: PROTOCOL_VERSION, id, cmd };
    if (payload !== undefined) {
      req.payload = payload;
    }

    const wire = encryptJson(this.key, serializeRequest(req));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const t = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("Command timed out."));
        }
      }, 12_000);
      const entry = this.pending.get(id)!;
      this.pending.set(id, {
        resolve: (r) => {
          clearTimeout(t);
          entry.resolve(r);
        },
        reject: (e) => {
          clearTimeout(t);
          entry.reject(e);
        },
      });
      this.ws!.send(wire);
    });
  }
}
