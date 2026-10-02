const fs = require("node:fs");
fs.appendFileSync(require("node:path").join(__dirname, "counterfeit-runs.txt"), "run\n");
const failure = new TypeError("user-assigned loader code");
Object.assign(failure, { code: "ERR_UNKNOWN_FILE_EXTENSION" });
throw failure;
