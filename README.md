# VibranceFlow Mobile

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Build Android APK](https://github.com/VibranceFlow/VibranceFlow-mobile/actions/workflows/build-android.yml/badge.svg)](https://github.com/VibranceFlow/VibranceFlow-mobile/actions/workflows/build-android.yml)

VibranceFlow Mobile is the Android companion app for controlling VibranceFlow Core on your Windows PC over local Wi-Fi.

## Release 1.0 scope

- Supported mobile release platform: **Android**
- Public build format: **APK (`vibranceflow-release.apk`)**
- iOS support remains in development flow only (not part of public 1.0 release)

## Install on Android

1. Open the repository **Releases** page.
2. Download the latest APK artifact.
3. Install it on your Android device (allow unknown sources when Android requests it).
4. Open the app and keep your phone on the same Wi-Fi as the Windows PC.

## Pairing with your PC

1. On Windows, open VibranceFlow Core and click **Pair Mobile**.
2. On Android, open VibranceFlow Mobile.
3. Pair using one of these methods:
   - scan the QR code from the PC (recommended)
   - enter the PC IP address and 6-digit pairing code

After pairing, all controls are available from the phone:

- color sliders (including Hue)
- app selection
- observer toggle
- per-app audio volume and mute (when live audio is available on PC)

## Troubleshooting (Android cannot connect)

The PC uses `ws://` on your LAN (not HTTPS). **Release APK builds before 2026-06 must be rebuilt** with the LAN cleartext network config (`plugins/withLanNetworkSecurity.js`).

On the phone:

1. Turn **mobile data OFF** (Wi‑Fi only). `192.168.x.x` is not reachable over 4G.
2. Confirm the phone Wi‑Fi IP is in the same subnet as the PC (e.g. both `192.168.1.x`).
3. On Windows: Pair Mobile open, **Allow in Firewall** approved, use the **current** 6-digit code.
4. In the app: **Forget pairing**, then enter IP + code again (not an old QR).

Quick test without sideloading a new APK:

```powershell
cd VibranceFlow-mobile
npm install
npx expo start
```

Open **Expo Go** on the phone (same Wi‑Fi), load the dev bundle, and try pairing. If Expo Go works but the GitHub APK does not, install a **new APK** from CI or build locally:

```powershell
npx expo prebuild --platform android --clean
cd android
.\gradlew assembleRelease
```

APK output: `android/app/build/outputs/apk/release/app-release.apk`

On the PC console, when the phone connects you should see `WS handshake from ('192.168.1.xx', ...)`. If nothing appears while the phone errors, the router may block client-to-client traffic (AP isolation).

## Privacy and data policy

- No cloud account required.
- No analytics or telemetry backend required.
- Pairing secrets stay on-device in secure storage.
- Communication is LAN-only and encrypted at the payload layer.

Security details: [docs/SECURITY.md](docs/SECURITY.md)

## 🛡️ Security, False Positives & Transparency

The Android APK is built in a clean CI flow using GitHub Actions with a zero-trust approach and no telemetry SDKs.

Even with a clean build pipeline, Android will show the standard **"install unknown apps"** warning when installing by sideload (outside Google Play). This is expected platform behavior and does not, by itself, indicate malware.

Transparency commitments:

- fully open-source project
- LAN-only architecture for control traffic
- encrypted local protocol with no cloud relay requirement
- zero analytics and zero background tracking

VirusTotal references (maintainer-updated):

- EXE scan: [Link to VirusTotal Scan - EXE/APK]
- APK scan: [Link to VirusTotal Scan - EXE/APK]

For technical users: always verify release integrity with the artifact hash/checksum before installation.

**Compatibility with VibranceFlow Core:** see [docs/CORE_APK_COMPATIBILITY.md](docs/CORE_APK_COMPATIBILITY.md) — core-only updates on protocol v1 do not require a new APK.

## ☕ Support the Project

Publishing software through trusted official channels requires recurring cost:

- Windows code-signing certificates (OV/EV): **US$80+/year**
- Apple Developer Program: **US$99/year**
- Google Play Store registration: **US$25** one-time

Support link: [Support VibranceFlow on Ko-fi](https://ko-fi.com/fabio_monreal)

If funding goals are reached, the ecosystem can move to signed binaries and official store distribution.  
Until then, the project remains open-source, free, and transparent in both build and security model.

## Troubleshooting

- **Cannot connect:** confirm both devices are on the same LAN and Core is allowed in Windows Firewall (private network).
- **Pairing fails after PC code refresh:** re-pair from the app.
- **Audio slider unavailable:** selected app has no active audio session on the PC.

## For developers

Development setup, Expo workflow, and contribution rules are documented in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

GPL-3.0 — see [LICENSE](LICENSE).
