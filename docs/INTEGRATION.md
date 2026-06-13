# Integration with VibranceFlow Core

This document is the contract between **VibranceFlow-mobile** and **VibranceFlow-core**. Keep both sides in sync when the protocol changes.

## Profile units (must match core)

Same as `ColorProfile` in core `core/models.py` and `profiles.json`:

| Field        | Type   | Range / notes               |
| ------------ | ------ | --------------------------- |
| `vibrance`   | number | 0–100 (percent)             |
| `brightness` | number | offset % (e.g. `42` = +42%) |
| `contrast`   | number | offset %                    |
| `gamma`      | number | 0.4–2.8                     |
| `hue`        | number | 0–359, optional             |

Per-app audio is tracked separately:

| Field                 | Type    | Range / notes                                                                              |
| --------------------- | ------- | ------------------------------------------------------------------------------------------ |
| `audio.volume`        | number  | 0–100 percent                                                                              |
| `audio.muted`         | boolean | mute override for the app                                                                  |
| `audio.available`     | boolean | runtime-only, true when the PC sees a live audio session                                   |
| `audio.session_count` | number  | how many live sessions matched the selected app                                            |
| `audio.backend`       | string  | backend used by the PC (`windows-wasapi`, `linux-pulseaudio`, etc.)                        |
| `audio.display_name`  | string  | preferred runtime label for the matched session(s)                                         |
| `audio.reason`        | string  | runtime reason such as `ok`, `mixed`, `no_session`, `backend_unavailable`, `backend_error` |

## Example plaintext payload (before encryption)

```json
{
  "v": 1,
  "id": "a1b2c3d4",
  "cmd": "set_sliders",
  "payload": {
    "vibrance": 80,
    "brightness": 10,
    "contrast": 5,
    "gamma": 1.05,
    "hue": 0
  }
}
```

Server responds (plaintext before encryption):

```json
{
  "v": 1,
  "id": "a1b2c3d4",
  "ok": true,
  "state": {
    "observer_enabled": true,
    "active_exe": "game.exe",
    "sliders": {
      "vibrance": 80,
      "brightness": 10,
      "contrast": 5,
      "gamma": 1.05,
      "hue": 0
    },
    "audio": {
      "available": true,
      "volume": 65,
      "muted": false
    },
    "programs": [
      {
        "exe": "game.exe",
        "sliders": {
          "vibrance": 80,
          "brightness": 10,
          "contrast": 5,
          "gamma": 1.05,
          "hue": 0
        },
        "audio": { "available": true, "volume": 65, "muted": false }
      }
    ]
  }
}
```

`programs` mirrors saved entries in `%APPDATA%\\VibranceFlow\\profiles.json`. Both UIs poll `get_state` (~1.5s) so local edits on PC or phone appear on the other side without reloading the app.

Audio is resolved from live sessions at runtime. Saved profile data stores only the desired `audio.volume` / `audio.muted` override; `available`, `session_count`, `backend`, `display_name`, and `reason` are computed on the PC each time state is requested.

When the PC closes the remote port, the server sends an encrypted frame `{"event":"port_closed","error":"port_closed"}` before disconnecting. The mobile app shows a waiting state and auto-reconnects when the port is opened again (same saved pairing key). After ~12 failed reconnect attempts, the app escalates to an error state with a re-pair hint.

## Error responses (v1)

Encrypted command responses may include:

| Field | When |
| ----- | ---- |
| `ok: false` | Any failure |
| `error` | Human-readable or stable token (see below) |
| `error_code` | Optional machine-readable code (`unknown_cmd`, `profile_save_failed`, `internal_error`, …) |

Common `error` values:

| `error` | Meaning | Mobile action |
| ------- | ------- | ------------- |
| `unauthorized` | Fernet decrypt failed / wrong key | Re-pair (do not use **New code** while paired) |
| `port_closed` | PC stopped remote port | Waiting + auto-reconnect |
| `timeout` | PC main thread did not respond in time | Retry or re-pair |
| `profile save failed` | Could not write `profiles.json` | Retry; check disk permissions on PC |
| `too_many_attempts` | PIN lockout (pairing only, plaintext) | Wait ~60s, retry PIN |
| `invalid or expired code` | Wrong or expired PIN | Refresh code on PC |

Pairing PIN responses are **plaintext** JSON (not Fernet).

## `get_state` optional field: `remote`

```json
"remote": {
  "listening": true,
  "client_count": 1,
  "last_error": null,
  "nvapi_available": true
}
```

Diagnostic only; mobile may ignore unknown fields.

## Commands (v1)

| Command         | Payload                                                    | Notes                                                                                     |
| --------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `ping`          | -                                                          | Health check                                                                              |
| `get_state`     | -                                                          | Observer, active exe, current sliders/audio, `programs[]`                                 |
| `set_sliders`   | vibrance, brightness, contrast, gamma, hue; optional `exe` | Applies immediately; saves profile when exe is known                                      |
| `set_audio`     | `volume`, `muted`; optional `exe`                          | Saves desired app audio and applies immediately to all matched live sessions for that app |
| `set_observer`  | `enabled` (bool)                                           | Toggles engine                                                                            |
| `reset_profile` | optional `exe`                                             | Resets profile to GPU defaults at PC startup; uses active exe if omitted                  |

## Wire format

UTF-8 JSON envelope, encrypted with Fernet (key from QR), sent as a **base64url** WebSocket text frame.

Mobile implements the same double-encoding as Python in `src/lib/fernetWire.ts`. The **inner** Fernet token base64 must keep `=` padding; the outer layer may omit padding (core `_b64url_decode` adds it back).

## Pairing (primary: IP + 6-digit code)

1. PC: **Pair Mobile** shows LAN **IP**, **6-digit code**, port `8765`.
2. Phone: enter IP + code → plaintext WebSocket frame (LAN only):

```json
{ "v": 1, "cmd": "pair", "pin": "482917" }
```

3. PC responds once (plaintext):

```json
{
  "v": 1,
  "ok": true,
  "host": "192.168.1.42",
  "port": 8765,
  "key": "<url-safe-fernet-key>"
}
```

4. All later frames use Fernet (double base64url) as below.

Code expires in ~15 minutes; **New code** on PC invalidates the previous one. QR / JSON remain optional.

## Pairing payload (QR / advanced)

```json
{ "v": 1, "host": "192.168.1.42", "port": 8765, "key": "<url-safe-fernet-key>" }
```

Mobile validates `host` is a private LAN IPv4 address before connecting.

## Settings keys (global)

From `AppSettings` / `profiles.json` `settings` section:

- `observer_enabled` (bool)
- `keep_remote_port_open` (bool) - when true, TCP 8765 stays up after closing Pair Mobile
- `desktop_vibrance`, `desktop_brightness`, `desktop_contrast`, `desktop_gamma`, `desktop_hue`

Mobile may expose observer toggle and "desktop colors" separately from per-game profiles.

## Versioning

- Wire protocol version is **`"v": 1`** (`PROTOCOL_VERSION` in core and mobile). Product semver (1.0.0 in `app.json` / releases) is separate.
- Bump `"v"` in QR JSON and message envelope **together** in core + mobile when breaking LAN compatibility.
- Mobile must refuse unknown major versions with a clear upgrade message.
- **Core-only updates** that keep v1 do **not** require a new APK - see [CORE_APK_COMPATIBILITY.md](CORE_APK_COMPATIBILITY.md).

## Repository boundaries

| Concern                | Owner repo          |
| ---------------------- | ------------------- |
| NVAPI / GDI            | VibranceFlow-core   |
| WebSocket server + QR  | VibranceFlow-core   |
| UI sliders + QR scan   | VibranceFlow-mobile |
| Public downloads / SEO | VibranceFlow-web    |

## References

- Core example config: `profiles.json.example` on [VibranceFlow-core](https://github.com/VibranceFlow/VibranceFlow-core)
- PoC validation (archived): [VibranceFlow-PoC](https://github.com/VibranceFlow/VibranceFlow-PoC)
