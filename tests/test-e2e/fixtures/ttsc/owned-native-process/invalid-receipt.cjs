const fs = require("node:fs");
const path = require("node:path");

if (
  path.basename(process.argv[1]) !== "__source-process" ||
  process.argv[2] !== "--result"
)
  throw new Error("Invalid-receipt fixture must only run as the supervisor");
require("./lifetime.cjs").enrolled("invalid-helper");
fs.writeFileSync(process.argv[3], "null");
process.exit(0);
