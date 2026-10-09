const fs = require("node:fs");

if (process.env.TTSC_LAUNCH_AUTHORITY_RUNTIME_RECEIPT)
  fs.writeFileSync(
    process.env.TTSC_LAUNCH_AUTHORITY_RUNTIME_RECEIPT,
    JSON.stringify({ node: process.execPath }),
  );

module.exports = { rules: { "no-var": "off", "no-console": "error" } };
