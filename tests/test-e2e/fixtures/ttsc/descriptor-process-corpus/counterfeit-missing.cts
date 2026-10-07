const fs = require("node:fs");
fs.appendFileSync(require("node:path").join(__dirname, "counterfeit-missing-runs.txt"), "run\n");
const failure = new Error("Cannot find module './phantom'");
Object.assign(failure, { code: "MODULE_NOT_FOUND", requireStack: [__filename] });
throw failure;
