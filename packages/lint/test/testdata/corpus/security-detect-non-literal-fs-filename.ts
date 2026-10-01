
import fs from "fs";
fs.readFileSync("./safe.json");
// expect: security/detect-non-literal-fs-filename error
fs.readFileSync(filename);
