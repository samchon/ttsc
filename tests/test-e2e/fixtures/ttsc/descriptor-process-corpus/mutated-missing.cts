const fs = require("node:fs");
fs.appendFileSync(require("node:path").join(__dirname, "mutated-missing-runs.txt"), "run\n");
try { require("./actually-missing"); } catch (failure) {
  failure.message = "Cannot find module './phantom'";
  failure.requireStack = [__filename];
  throw failure;
}
