const fs = require("node:fs");
const counter = process.env.TTSC_LINT_TEST_CACHE_COUNTER;
if (counter) {
  fs.appendFileSync(counter, JSON.stringify({
    pid: process.pid, location: __filename, at: new Date().toISOString(),
  }) + "\n");
}
module.exports = { format: { printWidth: 120 } };
