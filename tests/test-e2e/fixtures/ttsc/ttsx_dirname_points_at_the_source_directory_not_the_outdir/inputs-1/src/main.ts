import { TestGlobal } from "./TestGlobal";
declare const __dirname: string;
declare function require(name: string): {
  readFileSync(file: string, encoding: string): string;
};
const fs = require("node:fs");
console.log(fs.readFileSync(__dirname + "/marker.txt", "utf8"));
console.log(fs.readFileSync(TestGlobal.ROOT + "/template/data.txt", "utf8"));
console.log(__dirname);
console.log(TestGlobal.ROOT);
