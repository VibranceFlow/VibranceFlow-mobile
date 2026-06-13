# Security - VibranceFlow Mobile

VibranceFlow Mobile is a **local remote control** for your own PC. It does not use accounts, cloud backends, or analytics.

## Threat model (v1)

| Threat                                                           | Mitigation                                                                          |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Another device on the same Wi‑Fi reads or forges slider commands | Every WebSocket frame is **Fernet-encrypted** with a secret from PIN or QR pairing |
| Stolen phone backup exposes pairing                              | Fernet `key` stored in **expo-secure-store** only (not AsyncStorage)                |
| Malicious QR points phone at a public IP                         | App refuses WebSocket hosts outside **private / link-local** IPv4 ranges            |
| Accidental secret leakage via logs                               | Production code must not log `key` or decrypted payloads                            |
| Data sent to VibranceFlow servers                                | **None** - no internet API calls in the app runtime (LAN only)                      |

This is **local zero-trust**: the LAN is untrusted; only holders of the pairing key can issue valid commands.

## Data inventory

| Data                        | Stored? | Where       | Purpose                |
| --------------------------- | ------- | ----------- | ---------------------- |
| Fernet `key`                | Yes     | SecureStore | Encrypt commands to PC |
| LAN `host`, `port`          | Yes     | SecureStore | Reconnect to paired PC |
| User account / email        | No      | -           | -                      |
| Location, contacts, ads ID  | No      | -           | -                      |
| Command history             | No      | -           | In-memory session only |
| Crash / analytics telemetry | No      | -           | Not included in v1     |

## Permissions

| Permission          | When                                    |
| ------------------- | --------------------------------------- |
| Camera              | Pair screen only (QR scan)              |
| Local network (iOS) | Connecting to `ws://192.168.x.x` on LAN |

No microphone, Bluetooth, or location.

## User actions

- **Forget pairing** - deletes all pairing secrets from SecureStore and closes the socket.
- **Re-pair** - required when the PC LAN IP changes or the desktop regenerates the key.

## Out of scope for v1

- TLS on LAN (confidentiality is in Fernet payloads, not transport)
- Cloud relay, remote access over the internet
- Certificate pinning to a vendor backend (there is no vendor backend)

## Dependencies and `npm audit`

- **Runtime app** (Expo Go / device): only LAN WebSocket + Fernet + SecureStore + camera on Pair screen. No third-party analytics or cloud SDKs.
- **Dev tooling** (`expo`, Metro, CLI): used on your PC to bundle the app; not shipped as part of the VibranceFlow control logic.
- Patched transitive packages are pinned via `overrides` in `package.json` (`@xmldom/xmldom`, `postcss`, `tar`, `uuid`).
- After `npm install`, run `npm run audit:check` - expect **0 high** findings.
- Do **not** run `npm audit fix --force` (it would jump to an unrelated Expo major and break the project).

## Reporting issues

Open a GitHub issue on [VibranceFlow-mobile](https://github.com/VibranceFlow/VibranceFlow-mobile) with steps to reproduce. Do not paste real pairing `key` values in public issues.

Error handling reference: [docs/ERROR_HANDLING.md](docs/ERROR_HANDLING.md).
