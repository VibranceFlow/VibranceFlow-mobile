# Error handling - VibranceFlow Mobile

How the app surfaces LAN, pairing, and storage failures. Threat model: [`SECURITY.md`](SECURITY.md). Wire contract: [`INTEGRATION.md`](INTEGRATION.md).

## Pairing (PIN / QR)

| Situation | User message | Action |
| --------- | ------------ | ------ |
| Host not private LAN | Inline error from `validatePairingHost` | Fix IP |
| Wrong / expired PIN | PC `error` or default text | Retry code |
| PIN lockout (`too_many_attempts`) | Wait ~60 seconds | Retry |
| Protocol version mismatch | Expected v1 message | Update app + re-pair |
| Connection timeout | Firewall / PC not running hint | Check PC |

## Encrypted session (`wsClient.ts`)

| Situation | Behavior |
| --------- | -------- |
| `port_closed` | Status **waiting**; poll reconnect every 2.5s |
| Decrypt fail (stale key after **New code**) | After 2 bad frames → disconnect + re-pair message |
| `unauthorized` response | Reject all pending commands; disconnect + re-pair message |
| Ping timeout with bad key | Hint re-pair (not generic timeout) |
| Protocol `v` mismatch in response | Disconnect + upgrade message |
| Reconnect exhausted (~12 attempts) | Status **error** with reachability hint |

Constant: `KEY_MISMATCH_MESSAGE` in `src/lib/wsClient.ts`.

## Boot / storage

- **Loading**: spinner + “Loading pairing…”
- **Invalid saved pairing** (`validateStoredPairing`): clear SecureStore → Pair screen with reason (wrong `v`, host, or key)
- **SecureStore read failure**: clear + “Could not read saved pairing…”
- **Forget pairing write failure**: Alert; stay on Control screen

## In-session commands

Slider/audio errors update the status bar message. `unauthorized` on any command triggers full session teardown (same as key mismatch).

## Core diagnostics

If present in `get_state.state.remote`:

- `listening`, `client_count`, `last_error`, `nvapi_available` - for troubleshooting only.

Verify: `npm run typecheck`, `npm run verify:protocol`.
