# Android packaging and releases

VibranceFlow Mobile ships **five release APKs** per version: one **universal** build plus four **ABI splits** (smaller downloads per device). All builds share the same JavaScript bundle and protocol v1 wire format.

## How splits are enabled

During `expo prebuild`, the Expo config plugin [`plugins/withSizeOptimizations.js`](../plugins/withSizeOptimizations.js) injects into the generated `android/app/build.gradle`:

- R8 minify + shrink resources
- GIF/WebP disabled in release
- Gradle `splits.abi` with `universalApk true` and all `reactNativeArchitectures`

Do **not** commit the `android/` folder. CI runs `expo prebuild --clean` on every build.

## Gradle output (after `assembleRelease`)

| Gradle filename | Branded release filename |
| --- | --- |
| `app-universal-release.apk` | `vibranceflow-universal-release.apk` |
| `app-arm64-v8a-release.apk` | `vibranceflow-arm64-v8a-release.apk` |
| `app-armeabi-v7a-release.apk` | `vibranceflow-armeabi-v7a-release.apk` |
| `app-x86_64-release.apk` | `vibranceflow-x86_64-release.apk` |
| `app-x86-release.apk` | `vibranceflow-x86-release.apk` |

**Recommended for users:** `vibranceflow-universal-release.apk` (works on all devices).

## Local build (maintainer)

```bash
npm ci
npx expo prebuild --platform android --clean
cd android && chmod +x gradlew && ./gradlew assembleRelease
cd .. && bash scripts/package-release-apks.sh
```

Output: `dist/android-apk/` (5 APKs + 5 `.sha256` sidecars + `release-body.md` for GitHub notes).

Verify LAN cleartext after prebuild:

```bash
node scripts/verify-android-cleartext.js
```

## CI and GitHub Releases

| Workflow | Trigger | Output |
| --- | --- | --- |
| [`build-android.yml`](../.github/workflows/build-android.yml) | push to `main`, `workflow_dispatch` | Actions artifact: 5 APKs + SHA-256 sidecars |
| [`release-android.yml`](../.github/workflows/release-android.yml) | tag `v*`, `workflow_dispatch` | GitHub Release with all 10 files + hash table in notes |

Release steps (same pattern as VibranceFlow-core):

```bash
git tag -a v1.1.0 -m "VibranceFlow 1.1.0 Android"
git push origin v1.1.0
```

Or run **Release Android APK** manually in GitHub Actions with tag `v1.1.0`.

After publish, update [`VibranceFlow-web/downloads.json`](https://github.com/VibranceFlow/VibranceFlow-web/blob/main/downloads.json) with each APK URL, SHA-256, and optional VirusTotal link.

## Integrity verification

Each release APK has a sidecar `*.apk.sha256` (format: `<hash>  <filename>`).

```bash
sha256sum -c vibranceflow-universal-release.apk.sha256
```

On Windows (PowerShell):

```powershell
Get-FileHash ".\vibranceflow-universal-release.apk" -Algorithm SHA256
```

Compare with the value in the sidecar or GitHub Release notes.

## Guards before build

CI runs on every workflow:

- `npm run typecheck`
- `npm run verify:protocol`
- `node scripts/verify-android-cleartext.js` (after prebuild)

**CI note:** Do not set job-level `NODE_ENV=production` before `npm ci` - npm omits `devDependencies` (including `@types/*`) and `typecheck` fails. Install with `npm ci --include=dev`; set `NODE_ENV=production` only on the Gradle `assembleRelease` step.

If `package-release-apks.sh` finds fewer than 5 APKs, the job fails and lists the Gradle output directory for debugging.
