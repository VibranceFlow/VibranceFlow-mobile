# Core ↔ APK compatibility (protocol v1)

This document defines when a **GitHub release APK** keeps working after **VibranceFlow-core** updates, and when you must ship a new mobile build.

Expo Go success against `poetry run python gui_main.py` proves the **JavaScript protocol stack** matches core. The old GitHub APK failed because the **native Android shell** blocked `ws://` cleartext — fixed by `plugins/withLanNetworkSecurity.js` + CI check `scripts/verify-android-cleartext.js`.

## Locked contract (v1)

These values must stay aligned between repos (see [INTEGRATION.md](INTEGRATION.md)):

| Constant | Core | Mobile |
| -------- | ---- | ------ |
| Protocol `"v"` | `core/remote/pairing.py` → `PROTOCOL_VERSION = 1` | `src/types/protocol.ts` → `PROTOCOL_VERSION = 1` |
| Port | `DEFAULT_PORT = 8765` | `DEFAULT_REMOTE_PORT = 8765` |
| Transport | `ws://` LAN, bind `0.0.0.0` | `ws://${host}:${port}` |
| Pairing PIN | Plaintext `{v, cmd:"pair", pin}` | `src/lib/pairClient.ts` |
| Session wire | Fernet double base64url | `src/lib/fernetWire.ts` ↔ `core/remote/crypto.py` |
| Commands | `ping`, `get_state`, `set_sliders`, `set_audio`, `set_observer`, `reset_profile` | Same in `RemoteCommand` |

**Rule:** While all of the above stay on **v1**, a given APK release remains compatible with newer core `.exe` / `gui_main.py` builds.

## No new APK required (core-only changes)

Safe to update **only** VibranceFlow-core; keep the same APK:

- Windows GUI, tray, Pair Mobile layout, firewall UAC
- NVAPI / GDI / profiles / observer engine
- `keep_remote_port_open`, single-instance, Nuitka packaging
- Bug fixes in `core/remote/handlers.py` that keep the same JSON shapes
- **Optional** new fields in `get_state` (mobile ignores unknown fields)
- Server WebSocket tuning (e.g. `compression=None` for React Native)

## New APK required

Ship a new **VibranceFlow-mobile** release when:

- `PROTOCOL_VERSION` bumps (v2+)
- `DEFAULT_PORT` changes
- Fernet / wire format changes (`crypto.py` / `fernetWire.ts`)
- New **required** commands or breaking changes to `get_state` / slider payloads
- Android native config (`app.json`, cleartext plugin, permissions, Expo SDK major)
- Fixes in `pairClient.ts`, `wsClient.ts`, `pairingParse.ts`

## New core build recommended (not always mandatory)

- New **optional** mobile UI features that depend on new commands — old APK still runs, but cannot use new features until updated.

## Release pairing (recommended)

| Mobile APK | Core `.exe` | Notes |
| ---------- | ----------- | ----- |
| **1.0.x** (with LAN cleartext plugin) | **1.0.x** | Full remote control on protocol v1 |
| Pre-2026-06 GitHub APK | Any core | Missing cleartext config — use new APK or Expo Go |

Version numbers in `app.json` / core packaging are **product** versions, not the wire `"v": 1`. Wire version is the compatibility key.

## CI gates (automated)

### VibranceFlow-mobile (`build-android.yml`)

On every push to `main` (non-md):

1. `npm ci`
2. `expo prebuild --platform android --clean`
3. `node scripts/verify-android-cleartext.js` — fails if release APK would block `ws://`
4. `./gradlew assembleRelease`

**Suggested before merge:** `npm run typecheck`

### VibranceFlow-core (`build-windows.yml`)

On every push to `main` (non-md):

1. `scripts/test_remote_boot.py`
2. `scripts/test_prepare_pairing.py`
3. Nuitka build

**Suggested locally:** `scripts/test_pair_pin_client.py`, `scripts/ws_remote_client.py --pairing pairing.json --demo`

Cross-repo Fernet (workspace with both clones):

```powershell
cd VibranceFlow-mobile && npx tsx scripts/test-fernet-cmds-export.ts
cd VibranceFlow-core && poetry run python scripts/test_fernet_cmds.py
```

## When bumping protocol to v2

1. Update `PROTOCOL_VERSION` in **both** repos.
2. Update [INTEGRATION.md](INTEGRATION.md) and `.cursor/REMOTE.md` (workspace).
3. Release **core + mobile APK together** (same GitHub release window).
4. Mobile must show a clear “update the app” message for unknown `v`.

## Quick validation checklist

After a core change:

1. `poetry run python gui_main.py` → Pair Mobile open
2. `poetry run python scripts/test_pair_pin_client.py --host <LAN-IP> --pin <code>` → `ok: true`
3. Existing APK or Expo Go → connect and `get_state`

After a mobile change:

1. `npm run typecheck`
2. `npx expo prebuild --platform android --clean && npm run verify:android-cleartext`
3. Pair against current core on LAN

## References

- Wire contract: [INTEGRATION.md](INTEGRATION.md)
- Security model: [SECURITY.md](SECURITY.md)
- Expo Go vs APK: [COMPATIBILITY.md](COMPATIBILITY.md)
