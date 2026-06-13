#!/usr/bin/env node
/** Fail CI if release APK would block ws:// LAN (cleartext). */
const fs = require("fs");
const path = require("path");

const manifestPath = path.join(
  __dirname,
  "..",
  "android",
  "app",
  "src",
  "main",
  "AndroidManifest.xml",
);
const xmlPath = path.join(
  __dirname,
  "..",
  "android",
  "app",
  "src",
  "main",
  "res",
  "xml",
  "network_security_config.xml",
);

if (!fs.existsSync(manifestPath)) {
  console.error("Missing AndroidManifest.xml - run expo prebuild first.");
  process.exit(1);
}

const manifest = fs.readFileSync(manifestPath, "utf8");
const okManifest =
  manifest.includes('android:usesCleartextTraffic="true"') &&
  manifest.includes("network_security_config");

if (!okManifest) {
  console.error("AndroidManifest missing cleartext / networkSecurityConfig.");
  process.exit(1);
}

if (!fs.existsSync(xmlPath)) {
  console.error("Missing res/xml/network_security_config.xml");
  process.exit(1);
}

const xml = fs.readFileSync(xmlPath, "utf8");
if (!xml.includes("cleartextTrafficPermitted=\"true\"")) {
  console.error("network_security_config does not permit cleartext.");
  process.exit(1);
}

console.log("OK Android LAN cleartext config for ws://");
