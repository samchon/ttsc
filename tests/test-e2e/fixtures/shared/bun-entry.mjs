import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ttsc from "__BUN_ADAPTER__";
const result = await Bun.build({ entrypoints: ["./src/bundle.ts"], plugins: [ttsc()], target: "bun", format: "cjs", minify: false });
assert.equal(result.success, true, result.logs.join("\n"));
assert.equal(result.outputs.length, 1);
const code = await result.outputs[0].text();
const output = path.resolve("dist/bun-delivered.cjs");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, code);
let delivered;
try {
  delivered = createRequire(import.meta.url)(output);
  const payload = delivered.result;
  assert.ok(payload !== null && typeof payload === "object", "the actual CommonJS entry must publish its exported result");
  assert.equal(globalThis.TTSC_BATCH_RESULT, payload, "the authored global assignment and exported result must refer to the same delivered object");
  assert.equal(typeof delivered.observeEmittedEffects, "function");
  delivered.observeEmittedEffects();
  console.info("TTSC_BATCH:" + JSON.stringify(payload));
} catch (error) {
  console.error("TTSC_BUN_ARTIFACT:" + JSON.stringify({
    file: output,
    bytes: Buffer.byteLength(code),
    code,
    exportType: typeof delivered,
    exportKeys: delivered != null ? Object.keys(delivered) : [],
    resultType: typeof delivered?.result,
    globalResultType: typeof globalThis.TTSC_BATCH_RESULT,
  }));
  throw error;
}
