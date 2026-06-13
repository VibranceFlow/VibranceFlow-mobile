# VibranceFlow Mobile

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Build Android APK](https://github.com/VibranceFlow/VibranceFlow-mobile/actions/workflows/build-android.yml/badge.svg)](https://github.com/VibranceFlow/VibranceFlow-mobile/actions/workflows/build-android.yml)

VibranceFlow Mobile is the Android companion app for controlling VibranceFlow Core on your Windows PC over local Wi-Fi.

## Release 1.1 scope

- Supported mobile release platform: **Android**
- Public build format: **5 release APKs** (1 universal + 4 ABI splits) - see [docs/PACKAGING.md](docs/PACKAGING.md)
- iOS support remains in development flow only (not part of public 1.1 release)

## Why use the Mobile Remote?

The Windows Core app does everything on its own. This mobile companion exists purely for **convenience**:

- **No Alt-Tabbing:** Gamers can adjust display contrast, gamma, and background music volume (like Spotify) without leaving full-screen games.
- **Couch Control:** Watch movies on your PC and control the screen brightness and volume directly from your phone.
- **Accessibility Testing:** Designers can tweak saturation on the fly while looking at the full-screen canvas.

### App Preview

<p align="center">
  <img src="docs/images/vibranceflow-android-pair.jpeg" width="300" alt="Pairing Screen" />
  <img src="docs/images/vibranceflow-android-remote-control.jpeg" width="300" alt="Remote Control Screen" />
</p>

## Install on Android

1. Open the repository [**Releases**](https://github.com/VibranceFlow/VibranceFlow-mobile/releases/tag/V1.1.0) page (latest: **v1.1.0**).
2. Download **`vibranceflow-universal-release.apk`** (recommended for all devices).
3. Optional: use a split APK for your CPU (`arm64-v8a` for most phones, `armeabi-v7a` for older devices, `x86_64` / `x86` for emulators) - see [docs/PACKAGING.md](docs/PACKAGING.md).
4. Verify SHA-256 using the matching `.apk.sha256` sidecar on the same release.
5. Install on your Android device (allow unknown sources when Android requests it).
6. Open the app and keep your phone on the same Wi-Fi as the Windows PC.

## Pairing with your PC

1. On Windows, open VibranceFlow Core and click **Pair Mobile**.
2. On Android, open VibranceFlow Mobile.
3. Pair using one of these methods:
   - enter the PC IP address and 6-digit pairing code (primary; works without a camera)
   - scan the QR code from the PC (equivalent; recommended when the camera is available)

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
cd ..
bash scripts/package-release-apks.sh
```

Packaged output: `dist/android-apk/` (5 branded APKs). See [docs/PACKAGING.md](docs/PACKAGING.md).

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

VirusTotal references (v1.1.0 checksum sidecars on GitHub Releases):

| Build | SHA-256 (APK) | VirusTotal |
| --- | --- | --- |
| Universal | `cda8319e1c81b28961f1e4ad8bd95b3a789fd3f26bf3d71405eff49436c85775` | [Scan](https://www.virustotal.com/gui/file/e99341210c716f05d2bfd4de2fd2127076ea5b5110d35d79edd3bc4188e30cf6?nocache=1) |
| ARM64 (`arm64-v8a`) | `603b1bba96e89d44e19bd61ecc6732103cb220039360d2d24f7528dcd06cab08` | [Scan](https://www.virustotal.com/gui/file/6291a928100756c5ebbe027656cd2951149da643cb6dbc75ffedadb5eabec1c4?nocache=1) |
| ARM 32-bit (`armeabi-v7a`) | `02b1d33796fc088bbb4c7a59b2574fe000e42a96a5bfad55a8efae8b06cff85a` | [Scan](https://www.virustotal.com/gui/file/38427252a6ddeebfacd2c8ecf02365fa7a1c94c7e9696b7cc743fceee86415b6?nocache=1) |
| x86_64 | `98a34a208e271a7e82bb11f37ad177f2ce41af1833294dd2dc0835ead888cc56` | [Scan](https://www.virustotal.com/gui/file/c447c4c4a3c6a9c083e10bee33d72e5947c7d3860489c8480135ad1de19fe250?nocache=1) |
| x86 | `1abbe4c70644bf46514fddff348f1fc3946ac50b56deeb64715d119d51ba31b7` | [Scan](https://www.virustotal.com/gui/file/fcafc2b370d83df7e33b62ed74fe146cec2a501113640610b007f66295cc05f1?nocache=1) |

Windows `.exe` scan: [VibranceFlow-core v1.1.0 Release](https://github.com/VibranceFlow/VibranceFlow-core/releases/tag/V1.1.0) · [VirusTotal](https://www.virustotal.com/gui/file/de47071336775b4b8486b02e35be3b6583701d3a31a2f04d29cdc9fe2e95a960?nocache=1)

Direct downloads (v1.1.0):

| Build | APK | SHA-256 sidecar |
| --- | --- | --- |
| Universal | [Download](https://github.com/VibranceFlow/VibranceFlow-mobile/releases/download/V1.1.0/vibranceflow-universal-release.apk) | [`.sha256`](https://github.com/VibranceFlow/VibranceFlow-mobile/releases/download/V1.1.0/vibranceflow-universal-release.apk.sha256) |
| ARM64 | [Download](https://github.com/VibranceFlow/VibranceFlow-mobile/releases/download/V1.1.0/vibranceflow-arm64-v8a-release.apk) | [`.sha256`](https://github.com/VibranceFlow/VibranceFlow-mobile/releases/download/V1.1.0/vibranceflow-arm64-v8a-release.apk.sha256) |
| ARM 32-bit | [Download](https://github.com/VibranceFlow/VibranceFlow-mobile/releases/download/V1.1.0/vibranceflow-armeabi-v7a-release.apk) | [`.sha256`](https://github.com/VibranceFlow/VibranceFlow-mobile/releases/download/V1.1.0/vibranceflow-armeabi-v7a-release.apk.sha256) |
| x86_64 | [Download](https://github.com/VibranceFlow/VibranceFlow-mobile/releases/download/V1.1.0/vibranceflow-x86_64-release.apk) | [`.sha256`](https://github.com/VibranceFlow/VibranceFlow-mobile/releases/download/V1.1.0/vibranceflow-x86_64-release.apk.sha256) |
| x86 | [Download](https://github.com/VibranceFlow/VibranceFlow-mobile/releases/download/V1.1.0/vibranceflow-x86-release.apk) | [`.sha256`](https://github.com/VibranceFlow/VibranceFlow-mobile/releases/download/V1.1.0/vibranceflow-x86-release.apk.sha256) |

Before sideloading, verify the APK hash from the release artifact when a checksum is published.

**Compatibility with VibranceFlow Core:** see [docs/CORE_APK_COMPATIBILITY.md](docs/CORE_APK_COMPATIBILITY.md) - core-only updates on protocol v1 do not require a new APK.

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

Development setup, Expo workflow, Android packaging (5 APKs), and contribution rules:

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [docs/PACKAGING.md](docs/PACKAGING.md)

## License

GPL-3.0 - see [LICENSE](LICENSE).
