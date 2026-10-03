const fs = require("node:fs");
fs.appendFileSync(require("node:path").join(__dirname, "directory-candidate-race-runs.txt"), "run\n");
require("./directory-candidate");
