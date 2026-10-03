const fs = require("node:fs");
const path = require("node:path");
fs.appendFileSync(path.join(__dirname, "late-candidate-race-runs.txt"), "run\n");
try { require("./late-candidate"); } catch (failure) {
  fs.writeFileSync(path.join(__dirname, "late-candidate.ts"), "export const value = 1;\n");
  throw failure;
}
