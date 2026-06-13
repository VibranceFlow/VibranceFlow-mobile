# Mobile architecture

## Problem

Display tuning tools often require Alt+Tab during competitive play. VibranceFlow Mobile is a **local remote control**: adjust vibrance, brightness, contrast, gamma, and hue from the phone while the game stays fullscreen on Windows.

## Why LAN WebSockets (not Bluetooth)

| Approach                             | Verdict                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| Bluetooth on Windows (Python server) | Fragile pairing, poor desktop server story, higher latency for frequent slider events |
| HTTP polling                         | Too slow for real-time sliders                                                        |
| **WebSocket over Wi‑Fi/LAN**         | Persistent channel, low latency, straightforward Python server in core                |

Bluetooth may be explored later for discovery only; **v1 uses LAN**.

## Security model (local zero-trust)

Public CA TLS on raw LAN IPs is awkward (certificate warnings). v1 uses **payload encryption** instead:

1. Core generates a strong random key (Fernet / AES-256) per session or per pairing.
2. **Pairing v1:** Primary path is **IP + 6-digit PIN** (plaintext PIN exchange, then PC returns `host`, `port`, `key`). **QR** (or pasted JSON) is equivalent:

   ```json
   {
     "v": 1,
     "host": "192.168.1.42",
     "port": 8765,
     "key": "<base64-url-safe-fernet-key>"
   }
   ```

3. Phone stores `key` in secure storage, opens `ws://host:port`.
4. Every command is a JSON object, serialized, **encrypted**, sent as a WebSocket text frame.
5. Core rejects frames that fail decrypt or authentication (wrong key; replay without session id if added later).

Threat model: neighbors on the same Wi‑Fi cannot forge or read commands without the pairing secret. This is **not** a substitute for internet-facing TLS if a future cloud relay is added.

Full mobile policy: [SECURITY.md](SECURITY.md). Error matrix: [ERROR_HANDLING.md](ERROR_HANDLING.md).

### Mobile app (implemented constraints)

- Pairing secret in **expo-secure-store** only; **Forget pairing** wipes storage.
- WebSocket host must be **private / link-local IPv4** (app-side check).
- No analytics, accounts, or internet backends in v1.
- Camera used only on the Pair screen for QR.

### Hardening checklist

**Core (desktop) — v1 current**

- [x] Windows Firewall rule for TCP 8765 on **private** profile (optional UAC once)
- [x] Session rotation: **New code** invalidates old phone keys
- [x] Rate limits and maximum message size on server
- [x] PIN TTL, attempt limit, and lockout

**Core — future optional**

- [ ] Bind WebSocket to LAN interface only (today: `0.0.0.0` + private firewall rule)
- [ ] Require user confirmation on PC when a new device pairs

**Mobile — v1 current**

- [x] LAN host validation before connect
- [x] Redacted logging (no secrets in production)
- [x] Pairing secret in SecureStore only

**Mobile — future optional**

- [ ] TLS on LAN transport (protocol v2+)

## Message flow

```
┌─────────────┐  PIN or QR (once)  ┌─────────────┐
│ VibranceFlow│ ◄───────────────── │ Mobile app  │
│ Core (PC)   │                    │ Android/iOS │
└──────┬──────┘                    └──────┬──────┘
       │  ws://host:port                  │
       │  encrypted {"cmd":...}           │
       ◄──────────────────────────────────┤
       │  encrypted {"ok":true,...}       │
       └──────────────────────────────────►
```

## Commands (v1, implemented)

| Command         | Purpose                                            |
| --------------- | -------------------------------------------------- |
| `get_state`     | Observer, active exe, sliders, audio, saved `programs[]` |
| `set_sliders`   | Update sliders; optional `exe` for a saved profile |
| `set_audio`     | Per-app volume/mute; optional `exe`                |
| `set_observer`  | Enable/disable foreground observer                 |
| `reset_profile` | Reset active (or given) exe to GPU defaults        |
| `ping`          | Health check                                       |

Exact JSON schema: `docs/INTEGRATION.md` (field `v`).

## Desktop side (implemented in VibranceFlow-core, not this repo)

- Thread/async WebSocket server (e.g. `websockets` library).
- `qrcode` for on-screen pairing.
- `cryptography.fernet` for encrypt/decrypt.
- Reuse `WindowsDisplayManager` / `ProfileManager` — no duplicate NVAPI logic on phone.

## Mobile side (this repo)

- **Expo SDK 54** / React Native + TypeScript at repo root.
- Screens: **Pair** (IP + 6-digit PIN, QR scan), **Control** (sliders, program chips, observer, reset).
- `SliderRow`: native slider + tap value for numeric keyboard entry.
- Poll `get_state` ~1.5 s; on `port_closed`, show waiting UI and auto-reconnect when PC reopens port.
- Pairing secret in SecureStore; **Forget pairing** wipes storage.

## Alternatives considered

| Stack                 | Notes                                                              |
| --------------------- | ------------------------------------------------------------------ |
| Flutter + Dart        | Excellent UI; team picks one cross-platform stack and sticks to it |
| Native Kotlin + Swift | Best platform integration; double maintenance                      |

Default recommendation in README: Expo unless the repository already standardizes on Flutter.
