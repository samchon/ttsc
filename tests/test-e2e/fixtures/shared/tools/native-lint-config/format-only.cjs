const fs = require("node:fs");
const counter = process.env.TTSC_LINT_TEST_CACHE_COUNTER;
if (counter) {
  const calls = Number(fs.readFileSync(counter, "utf8"));
  fs.writeFileSync(counter, String(calls + 1));
}
module.exports = { format: { printWidth: 120 } };
