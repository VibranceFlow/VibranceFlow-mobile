# Contributing to VibranceFlow Mobile

Thank you for helping build the mobile remote for VibranceFlow.

## Prerequisites

- Node.js LTS (when the app scaffold exists)
- Expo CLI or `npx expo` per project README
- A Windows PC running [VibranceFlow-core](https://github.com/VibranceFlow/VibranceFlow-core) on the same LAN for integration tests

## Setup

```powershell
cd VibranceFlow-mobile
npm install
npm run start:lan
```

Install **Expo Go** on your device. Keep the phone and Windows PC on the same LAN (mobile data **off** on the phone). For protocol details see `docs/INTEGRATION.md` and `docs/SECURITY.md`.

**Release APK vs Expo Go:** Expo Go loads JS from Metro — good for protocol testing. Sideloaded APKs need `plugins/withLanNetworkSecurity.js` (CI verifies cleartext). Old GitHub APKs without that plugin cannot use `ws://` on Android.

**Core compatibility:** core-only updates that keep wire **v1** do not require a new APK. See `docs/CORE_APK_COMPATIBILITY.md`.

### Verify before PR (mobile)

```powershell
npm run typecheck
npm run verify:protocol
npx expo prebuild --platform android --clean
npm run verify:android-cleartext
```

Cross-repo Fernet (when touching `fernetWire.ts` or `core/remote/crypto.py`):

```powershell
npx tsx scripts/test-fernet-cmds-export.ts
# in VibranceFlow-core:
poetry run python scripts/test_fernet_cmds.py
```

**Security rules:** no cloud/analytics SDKs; pairing secrets only in `expo-secure-store`; validate LAN hosts with `src/lib/netPolicy.ts`; never log Fernet keys.

## Commit message format

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<optional scope>): <short description>

[optional body]

[optional footer(s)]
```

### Types

| Type       | Use for                         |
| ---------- | ------------------------------- |
| `feat`     | New feature                     |
| `fix`      | Bug fix                         |
| `docs`     | Documentation only              |
| `style`    | Formatting, no logic change     |
| `refactor` | Code change without feature/fix |
| `test`     | Tests                           |
| `chore`    | Tooling, deps, CI               |

### Examples

```
feat(pairing): add QR scanner screen
fix(ws): reconnect after app resumes from background
docs: describe Fernet envelope in INTEGRATION.md
```

### Rules

- Subject line ≤ 72 characters; use imperative mood ("add" not "added").
- Reference issues as `Fixes #12` or `Refs #12` in the footer when applicable.
- One logical change per commit when possible.
- English for commit messages and PR descriptions.

## Pull requests

1. Branch from `main`: `feature/short-name` or `fix/short-name`.
2. Describe manual test steps (device, OS version, core version).
3. No drive-by refactors unrelated to the PR.
4. Update `README.md` or `docs/` if behavior or protocol changes.
5. Bump wire `"v"` in **both** core and mobile when breaking LAN compatibility; release APK and core together.

## Code style

- TypeScript strict mode when the project is initialized.
- English for identifiers, comments, and user-visible strings.
- Keep secrets out of logs and git. The app does not use environment variables for pairing; store the Fernet key only in **expo-secure-store**. Local dev scripts may use `.test-key.txt` (gitignored) for cross-repo Fernet tests.

## License

By contributing, you agree that your contributions are licensed under the GPL-3.0 license in `LICENSE`.
