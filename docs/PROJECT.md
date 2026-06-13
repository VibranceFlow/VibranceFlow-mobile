# Project overview

Cross-platform remote control app (Android + iOS) for [VibranceFlow Core](https://github.com/VibranceFlow/VibranceFlow-core). Lets users adjust display color settings from the phone without Alt+Tab during games.

## Ecosystem

| Repository                                                                 | Role                  | License |
| -------------------------------------------------------------------------- | --------------------- | ------- |
| [VibranceFlow-core](https://github.com/VibranceFlow/VibranceFlow-core)     | Windows engine + GUI  | GPL-3.0 |
| [VibranceFlow-mobile](https://github.com/VibranceFlow/VibranceFlow-mobile) | This repo             | GPL-3.0 |
| [VibranceFlow-PoC](https://github.com/VibranceFlow/VibranceFlow-PoC)       | Archived validation   | -       |
| [VibranceFlow-web](https://github.com/VibranceFlow/VibranceFlow-web)       | Landing site (Vercel) | MIT     |

## Communication model (implemented v1)

- **Transport:** WebSocket over LAN (Wi‑Fi) on port `8765`; Bluetooth is not used in v1.
- **Pairing:** Primary method is **IP + 6-digit PIN** from the desktop Pair Mobile dialog. **QR** (or pasted JSON) is an equivalent alternative that delivers `host`, `port`, and session key directly.
- **Security:** AES-256 (Fernet) for all post-pairing command payloads; wrong-key frames are rejected (local zero-trust). Pairing uses a short cleartext window over `ws://` - see [SECURITY.md](SECURITY.md).
- **Latency:** Persistent socket so slider changes apply in near real time.

Details: [ARCHITECTURE.md](ARCHITECTURE.md), [INTEGRATION.md](INTEGRATION.md).

## Conventions

- User-facing strings and code comments in **English**.
- [Conventional Commits](https://www.conventionalcommits.org/) - see [CONTRIBUTING.md](../CONTRIBUTING.md).
- Stack direction: **Expo / React Native** (TypeScript) unless the repo already contains Flutter.

## Core contract (do not break)

Profile fields match core `ColorProfile` / `profiles.json`:

- `vibrance` 0–100 (%)
- `brightness`, `contrast` - offset %
- `gamma` 0.4–2.8
- `hue` 0–359 (optional)

Desktop settings keys: `observer_enabled`, desktop color fields - see [INTEGRATION.md](INTEGRATION.md).

## Further reading

1. [ARCHITECTURE.md](ARCHITECTURE.md)
2. [INTEGRATION.md](INTEGRATION.md)
3. Core README and `profiles.json.example` on GitHub
