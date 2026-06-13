# Device and Expo Go compatibility

## Expo Go (development)

**Expo Go only supports one SDK version** - the latest release on the Play Store / App Store.

| Your Expo Go                 | Project must use                  |
| ---------------------------- | --------------------------------- |
| SDK 54 (current store build) | Expo SDK **54** in `package.json` |

You cannot open an SDK 52 project in Expo Go SDK 54 (or the reverse). This project targets **SDK 54** to match current Expo Go.

After upgrading SDK, on the phone:

1. Update **Expo Go** from the store.
2. On PC: delete `.expo` folder if the bundler caches old SDK, then `npm install` and `npm run start:lan`.
3. Scan the **terminal** QR again to reload the app.

## Older phones (production)

Expo Go is for development only. For users on **older Android / iOS** devices:

- Ship a **standalone APK / IPA** (EAS Build or local build), not Expo Go.
- Set minimum OS versions in `app.json` when you add EAS (typical Expo SDK 54: Android 7+ / API 24, iOS 15+ - confirm in [Expo docs](https://docs.expo.dev/versions/latest/) when building).
- Test on the oldest device you want to support before release.

## Supporting “old and new” Expo Go

Not possible in a **single** repo branch at the same time. Options:

| Approach                     | Use when                                                        |
| ---------------------------- | --------------------------------------------------------------- |
| **One SDK (54)** - this repo | Normal development with latest Expo Go                          |
| Git branch `sdk-52`          | Legacy testing only; install old Expo Go APK from Expo archives |
| **Development build**        | Custom native app; not tied to store Expo Go version            |

## VibranceFlow protocol

Pairing and WebSocket protocol (`v: 1`) are independent of Expo SDK. Upgrading Expo does not change LAN security or core compatibility.

**Core ↔ APK:** see [CORE_APK_COMPATIBILITY.md](CORE_APK_COMPATIBILITY.md) - when a GitHub APK stays valid after core updates, and when you must rebuild mobile.

## Expo Go vs production app

| Mode                               | Who uses it                                                       |
| ---------------------------------- | ----------------------------------------------------------------- |
| **Expo Go** + `npm run start:lan`  | You, while developing on a real phone                             |
| **APK / IPA** (EAS Build or local) | End users install **VibranceFlow** - they do **not** need Expo Go |

Expo Go only loads your JavaScript bundle from the PC during development. A store or sideloaded build embeds the app and does not depend on Metro or the terminal QR.
