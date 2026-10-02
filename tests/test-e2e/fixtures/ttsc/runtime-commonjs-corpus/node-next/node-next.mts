import { result } from "./cjs-consumer.js";
import { message } from "./mts-helper.mjs";
declare const process: { exitCode: number };
console.log("BEGIN:mts-entry");
try { console.log(message); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:mts-entry");
console.log("BEGIN:commonjs-lowering");
try { console.log(result); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:commonjs-lowering");

console.log("BEGIN:nested-star");
try { await import("./nested-star.js"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:nested-star");
