const fs = require("node:fs");
const path = require("node:path");
enum Loaded { Value = "loaded" }
console.log("DESCRIPTOR_STDOUT_MARKER", Loaded.Value);
export = () => {
  fs.appendFileSync(path.join(__dirname, "factory-runs.txt"), "run\n");
  throw new Error("factory-env:" + process.env.TTSC_DESC_MARKER);
};
