const fs = require("node:fs");
fs.appendFileSync(require("node:path").join(__dirname, "module-runs.txt"), "run\n");
throw new Error("module-initialization:loaded");
