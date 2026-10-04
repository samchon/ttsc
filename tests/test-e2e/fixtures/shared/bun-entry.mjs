import assert from "node:assert/strict";
import ttsc from "__BUN_ADAPTER__";
const result = await Bun.build({ entrypoints: ["./src/bundle.ts"], plugins: [ttsc()], target: "bun", format: "cjs", minify: false });
assert.equal(result.success, true, result.logs.join("\n"));
assert.equal(result.outputs.length, 1);
const code = await result.outputs[0].text();
new Function("exports", "module", code)({}, { exports: {} });
console.info("TTSC_BATCH:" + JSON.stringify(globalThis.TTSC_BATCH_RESULT));

