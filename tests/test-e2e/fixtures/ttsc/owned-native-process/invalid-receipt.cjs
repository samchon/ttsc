const fs = require("node:fs");
const path = require("node:path");

if (
  path.basename(process.argv[1]) !== "__source-process" ||
  process.argv[2] !== "--result"
)
  throw new Error("Invalid-receipt fixture must only run as the supervisor");
require("./lifetime.cjs").enrolled(process.env.TTSC_LIFETIME_HELPER_ROLE);
const mode = process.env.TTSC_OWNED_INVALID_RECEIPT_MODE;
if (!["null", "object", "malformed"].includes(mode))
  throw new Error("Invalid-receipt fixture requires an explicit authored mode");
const receipt = mode === "null" ? null : {
  version: 1,
  pid: process.pid,
  status: null,
  signal: null,
  cancelled: false,
  error: {
    code: mode === "malformed" ? { stdout: "nested object decoy" } : "AUTHORED_CLEANUP",
    message: "authored unproved cleanup",
    extra: "error decoy",
  },
  cleanup: {
    directChildJoined: true,
    boundaryEmpty: false,
    orphanReaping: mode === "malformed" ? ["nested array decoy"] : "owned",
    extra: "cleanup decoy",
  },
  stdout: "stdout decoy",
  stderr: "stderr decoy",
  "diagnostic-extra": "root decoy",
};
fs.writeFileSync(process.argv[3], JSON.stringify(receipt));
process.exit(0);
