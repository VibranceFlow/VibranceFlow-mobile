/**
 * Fernet wire format - matches VibranceFlow-core/core/remote/crypto.py
 * AES-128-CBC via aes-js (CryptoJS AES breaks multi-block payloads).
 */
import aes from "aes-js";
import { Buffer } from "buffer";
import CryptoJS from "crypto-js";

const FERNET_VERSION = 0x80;

function b64UrlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64UrlDecode(wire: string): Uint8Array {
  let b64 = wire.replace(/-/g, "+").replace(/_/g, "/");
  const pad = -b64.length % 4;
  if (pad) b64 += "=".repeat(pad);
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/** Fernet token layer: keep `=` padding (Python Fernet.decrypt requires it). */
function fernetTokenToB64(token: Uint8Array): string {
  return Buffer.from(token)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/_/g, "_");
}

function concat(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function decodeFernetKey(key: string): {
  signKey: Uint8Array;
  encKey: Uint8Array;
} {
  const raw = b64UrlDecode(key);
  if (raw.length !== 32) {
    throw new Error("invalid Fernet key length");
  }
  return { signKey: raw.slice(0, 16), encKey: raw.slice(16, 32) };
}

function writeTimestamp(seconds: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, BigInt(seconds));
  return new Uint8Array(buf);
}

function readTimestamp(bytes: Uint8Array): number {
  return Number(
    new DataView(bytes.buffer, bytes.byteOffset, 8).getBigUint64(0),
  );
}

function randomIv(): Uint8Array {
  const iv = new Uint8Array(16);
  crypto.getRandomValues(iv);
  return iv;
}

function pkcs7Pad(bytes: number[]): number[] {
  const block = 16;
  const pad = block - (bytes.length % block);
  const out = bytes.slice();
  for (let i = 0; i < pad; i++) out.push(pad);
  return out;
}

function pkcs7Unpad(bytes: number[]): number[] {
  if (bytes.length === 0) throw new Error("decrypt failed");
  const pad = bytes[bytes.length - 1];
  if (pad < 1 || pad > 16) throw new Error("decrypt failed");
  return bytes.slice(0, bytes.length - pad);
}

function toWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
  return CryptoJS.lib.WordArray.create(bytes as unknown as number[]);
}

function hmacSha256(data: Uint8Array, signKey: Uint8Array): Uint8Array {
  const out = CryptoJS.HmacSHA256(toWordArray(data), toWordArray(signKey));
  const words = out.words;
  const sigBytes = out.sigBytes;
  const result = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i++) {
    result[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return result;
}

function aesEncrypt(
  plaintext: string,
  encKey: Uint8Array,
  iv: Uint8Array,
): Uint8Array {
  const textBytes = aes.utils.utf8.toBytes(plaintext);
  const padded = pkcs7Pad(Array.from(textBytes));
  const cbc = new aes.ModeOfOperation.cbc(Array.from(encKey), Array.from(iv));
  return new Uint8Array(cbc.encrypt(padded));
}

function aesDecrypt(
  ciphertext: Uint8Array,
  encKey: Uint8Array,
  iv: Uint8Array,
): string {
  const cbc = new aes.ModeOfOperation.cbc(Array.from(encKey), Array.from(iv));
  const decrypted = cbc.decrypt(Array.from(ciphertext));
  const unpadded = pkcs7Unpad([...decrypted]);
  return aes.utils.utf8.fromBytes(unpadded);
}

function buildToken(plaintext: string, key: string): Uint8Array {
  const { signKey, encKey } = decodeFernetKey(key);
  const iv = randomIv();
  const timestamp = writeTimestamp(Math.floor(Date.now() / 1000));
  const ciphertext = aesEncrypt(plaintext, encKey, iv);
  const signed = concat([
    new Uint8Array([FERNET_VERSION]),
    timestamp,
    iv,
    ciphertext,
  ]);
  const hmac = hmacSha256(signed, signKey);
  return concat([signed, hmac]);
}

function verifyAndDecrypt(
  token: Uint8Array,
  key: string,
  maxAgeSec: number | null,
): string {
  if (token.length < 57) {
    throw new Error("token too short");
  }
  const { signKey, encKey } = decodeFernetKey(key);
  const hmacStart = token.length - 32;
  const signed = token.slice(0, hmacStart);
  const hmac = token.slice(hmacStart);
  const expected = hmacSha256(signed, signKey);
  if (expected.length !== hmac.length) {
    throw new Error("decrypt failed");
  }
  for (let i = 0; i < hmac.length; i++) {
    if (expected[i] !== hmac[i]) throw new Error("decrypt failed");
  }
  if (signed[0] !== FERNET_VERSION) {
    throw new Error("decrypt failed");
  }
  const ts = readTimestamp(signed.slice(1, 9));
  if (maxAgeSec !== null) {
    const now = Math.floor(Date.now() / 1000);
    if (ts + maxAgeSec < now) {
      throw new Error("decrypt failed");
    }
  }
  const iv = signed.slice(9, 25);
  const ciphertext = signed.slice(25);
  return aesDecrypt(ciphertext, encKey, iv);
}

/** Encrypt JSON payload for WebSocket (double base64url, same as crypto.py). */
export function encryptJson(key: string, plaintext: string): string {
  const raw = buildToken(plaintext, key);
  const innerAscii = Buffer.from(fernetTokenToB64(raw), "ascii");
  return b64UrlEncode(new Uint8Array(innerAscii));
}

/** Decrypt WebSocket frame; TTL off by default (same as core Fernet.decrypt without ttl). */
export function decryptJson(
  key: string,
  wire: string,
  maxAgeSec: number | null = null,
): string {
  try {
    const innerAscii = Buffer.from(b64UrlDecode(wire.trim())).toString("ascii");
    const token = b64UrlDecode(innerAscii.trim());
    return verifyAndDecrypt(token, key, maxAgeSec);
  } catch {
    throw new Error("decrypt failed");
  }
}
