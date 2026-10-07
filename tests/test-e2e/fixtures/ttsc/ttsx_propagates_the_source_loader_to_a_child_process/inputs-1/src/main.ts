const { spawnSync } = require("node:child_process");
const result = spawnSync(
  process.execPath,
  [__dirname + "/worker.ts"],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
