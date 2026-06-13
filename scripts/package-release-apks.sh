#!/usr/bin/env bash
# Package Gradle ABI-split APKs into branded release filenames + SHA-256 sidecars.
# Requires: expo prebuild + ./gradlew assembleRelease (see docs/PACKAGING.md).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GRADLE_OUT="$ROOT/android/app/build/outputs/apk/release"
OUT_DIR="$ROOT/dist/android-apk"

mkdir -p "$OUT_DIR"

declare -A MAP=(
  ["app-universal-release.apk"]="vibranceflow-universal-release.apk"
  ["app-arm64-v8a-release.apk"]="vibranceflow-arm64-v8a-release.apk"
  ["app-armeabi-v7a-release.apk"]="vibranceflow-armeabi-v7a-release.apk"
  ["app-x86-release.apk"]="vibranceflow-x86-release.apk"
  ["app-x86_64-release.apk"]="vibranceflow-x86_64-release.apk"
)

rm -f "$OUT_DIR"/*.apk "$OUT_DIR"/*.sha256 "$OUT_DIR"/release-hashes.md "$OUT_DIR"/release-body.md

found=0
{
  echo "## SHA-256 (verify before sideload)"
  echo ""
  echo "Most users should install **vibranceflow-universal-release.apk**. Split APKs are smaller per CPU."
  echo ""
} > "$OUT_DIR/release-hashes.md"

for src in "${!MAP[@]}"; do
  dst="${MAP[$src]}"
  if [[ -f "$GRADLE_OUT/$src" ]]; then
    cp "$GRADLE_OUT/$src" "$OUT_DIR/$dst"
    hash="$(sha256sum "$OUT_DIR/$dst" | awk '{print $1}')"
    printf '%s  %s\n' "$hash" "$dst" > "$OUT_DIR/${dst}.sha256"
    echo "- **${dst}:** \`${hash}\`" >> "$OUT_DIR/release-hashes.md"
    found=$((found + 1))
  else
    echo "Missing expected APK: $GRADLE_OUT/$src" >&2
  fi
done

if [[ "$found" -ne 5 ]]; then
  echo "Expected 5 release APKs, packaged $found." >&2
  echo "Gradle output directory:" >&2
  ls -la "$GRADLE_OUT" >&2 || true
  exit 1
fi

{
  echo "## Downloads"
  echo ""
  echo "| APK | Use case |"
  echo "| --- | --- |"
  echo "| vibranceflow-universal-release.apk | **Recommended** - all devices |"
  echo "| vibranceflow-arm64-v8a-release.apk | Most phones (2017+) |"
  echo "| vibranceflow-armeabi-v7a-release.apk | Older 32-bit ARM phones |"
  echo "| vibranceflow-x86_64-release.apk | Emulators / rare Intel tablets |"
  echo "| vibranceflow-x86-release.apk | Legacy x86 emulators |"
  echo ""
  cat "$OUT_DIR/release-hashes.md"
  echo ""
  echo "Each \`.apk\` has a matching \`.apk.sha256\` sidecar in this release."
  echo ""
  echo "## Protocol"
  echo ""
  echo "Compatible with VibranceFlow Core **protocol v1** (WebSocket port 8765, Fernet wire)."
} > "$OUT_DIR/release-body.md"

echo "Packaged $found APKs into $OUT_DIR"
