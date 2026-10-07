import { TestGlobal } from "./TestGlobal";
declare const __dirname: string;
declare function require(name: string): { readFileSync(file: string, encoding: string): string };
const fs = require("node:fs");
export const sourceLocations = {
  marker: fs.readFileSync(__dirname + "/marker.txt", "utf8"),
  template: fs.readFileSync(TestGlobal.ROOT + "/template/data.txt", "utf8"),
  directory: __dirname,
  classRoot: TestGlobal.ROOT,
};
