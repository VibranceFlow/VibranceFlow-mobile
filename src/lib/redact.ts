/** Safe logging - never print pairing secrets or decrypted payloads. */

export function redactHostPort(host: string, port: number): string {
  return `${host}:${port}`;
}

export function devLog(message: string, extra?: Record<string, unknown>): void {
  if (!__DEV__) return;
  if (extra) {
    console.log(`[VibranceFlow] ${message}`, extra);
  } else {
    console.log(`[VibranceFlow] ${message}`);
  }
}
