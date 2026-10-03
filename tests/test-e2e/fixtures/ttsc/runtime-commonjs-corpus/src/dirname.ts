import { TestGlobal } from "./TestGlobal";
import { runNativeChildCorpus } from "./native-child-corpus";
import { runNativeDependencyPublicationCorpus } from "./native-dependency-publication";
declare const __dirname: string;
declare function require(name: string): { readFileSync(file: string, encoding: string): string };
const fs = require("node:fs");
console.log(fs.readFileSync(__dirname + "/marker.txt", "utf8"));
console.log(fs.readFileSync(TestGlobal.ROOT + "/template/data.txt", "utf8"));
console.log(__dirname);
console.log(TestGlobal.ROOT);
console.log("relative-runner-cache");
require("./suppressed-emit");

declare const process: { exitCode: number; env: Record<string, string | undefined> };
console.log("BEGIN:extension-detection");
try { require("./extensions/main"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:extension-detection");
console.log("linked-run");
void runNativeChildCorpus(
  ["propagation", "fork", "concurrency"],
  TestGlobal.ROOT,
).catch((error) => {
  console.log("FAILED:" + String(error));
  process.exitCode = 1;
}).then(() => {
  const physicalRootsAvailable = process.env.TTSX_TEST_PHYSICAL_ROOTS === "1";
  if (!physicalRootsAvailable) console.log("CAPABILITY-SKIPPED:native-physical-dependency-roots");
  try { runNativeDependencyPublicationCorpus(TestGlobal.ROOT, physicalRootsAvailable); }
  catch (error) {
    console.log("FAILED:" + String(error));
    process.exitCode = 1;
  }
});
