import { DEFAULT_REMOTE_PORT, PROTOCOL_VERSION } from "../src/types/protocol";

const EXPECTED_VERSION = 1;
const EXPECTED_PORT = 8765;

let ok = true;
if (PROTOCOL_VERSION !== EXPECTED_VERSION) {
  console.error(`FAIL: PROTOCOL_VERSION=${PROTOCOL_VERSION}, expected ${EXPECTED_VERSION}`);
  ok = false;
}
if (DEFAULT_REMOTE_PORT !== EXPECTED_PORT) {
  console.error(`FAIL: DEFAULT_REMOTE_PORT=${DEFAULT_REMOTE_PORT}, expected ${EXPECTED_PORT}`);
  ok = false;
}
if (ok) {
  console.log(`OK protocol v${EXPECTED_VERSION} port ${EXPECTED_PORT}`);
  process.exit(0);
}
console.error("Bump INTEGRATION.md and VibranceFlow-core together when changing these.");
process.exit(1);
