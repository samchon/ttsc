import { view } from "./register-view.js";
declare const console: { log(value: unknown): void };
declare function require(id: string): any;
console.log("TTSC_REGISTER_VIEW:" + view);
const runtimeProcess = (globalThis as any).process;
const runtimePath = require("node:path");
require(runtimePath.join(runtimeProcess.cwd(), "src/runtime-corpus/declaration-entry.cts"));
