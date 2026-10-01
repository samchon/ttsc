
import fs from "fs";
let filename = "./safe.json";
(filename as string) = input;
// expect: security/detect-non-literal-fs-filename error
fs.readFileSync(filename);
