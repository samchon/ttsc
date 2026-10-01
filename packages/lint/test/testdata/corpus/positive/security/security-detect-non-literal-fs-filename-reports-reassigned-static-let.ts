
import fs from "fs";
let filename = "./safe.json";
filename = input;
// expect: security/detect-non-literal-fs-filename error
fs.readFileSync(filename);
