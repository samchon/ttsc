const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const marker = process.env.TTSC_OWNER_PRELOAD_MARKER;
if (process.env.TTSX_RUNTIME_MANIFEST) {
  const owner = JSON.parse(fs.readFileSync(path.join(process.env.TTSX_RUNTIME_RUN_DIR, `owner-${process.pid}.json`), "utf8"));
  assert.deepEqual(owner, { hostname: os.hostname(), pid: process.pid });
  fs.writeFileSync(marker, "claimed-before-user");
  console.log("TTSC_OWNER_PRELOAD:claimed-before-user");
} else {
  assert.equal(fs.existsSync(process.env.TTSX_RUNTIME_RUN_DIR), false);
  fs.writeFileSync(marker, "independent");
  console.log("TTSC_OWNER_PRELOAD:independent");
}
