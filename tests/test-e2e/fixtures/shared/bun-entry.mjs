import assert from "node:assert/strict";
import ttsc from "__BUN_ADAPTER__";
const result = await Bun.build({ entrypoints: ["./src/bundle.ts"], plugins: [ttsc()], target: "bun", format: "cjs", minify: false });
assert.equal(result.success, true, result.logs.join("\n"));
assert.equal(result.outputs.length, 1);
const code = await result.outputs[0].text();
const module = { exports: {} };
new Function("exports", "module", code)(module.exports, module);
const payload = module.exports.result;
assert.ok(payload !== null && typeof payload === "object", "the actual CommonJS entry must publish its exported result");
assert.equal(globalThis.TTSC_BATCH_RESULT, payload, "the authored global assignment and exported result must refer to the same delivered object");
console.info("TTSC_BATCH:" + JSON.stringify(payload));

