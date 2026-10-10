import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ttsc from "__BUN_ADAPTER__";
const plugin = ttsc();
const receiptCount = () => fs.existsSync(process.env.TTSC_E2E_BUN_RECEIPTS) ? fs.readFileSync(process.env.TTSC_E2E_BUN_RECEIPTS, "utf8").split(/\r?\n/).filter(Boolean).length : 0;
const epochs = [receiptCount()];
const tickCount = () => fs.existsSync(process.env.TTSC_E2E_BUN_PROGRAM_LOG) ? fs.statSync(process.env.TTSC_E2E_BUN_PROGRAM_LOG).size : 0;
const ticks = [tickCount()];
for (let pass = 0; pass < 2; pass++) {
const result = await Bun.build({ entrypoints: ["./src/bundle.ts"], plugins: [plugin], target: "bun", format: "cjs", minify: false });
assert.equal(result.success, true, result.logs.join("\n"));
assert.equal(result.outputs.length, 1);
const code = await result.outputs[0].text();
const output = path.resolve(`dist/bun-delivered-${pass}.cjs`);
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
  console.info((pass === 0 ? "TTSC_BATCH:" : "TTSC_BUN_SECOND:") + JSON.stringify(payload));
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
epochs.push(receiptCount());
ticks.push(tickCount());
}
console.info("TTSC_BUN_EPOCHS:" + JSON.stringify(epochs));
console.info("TTSC_BUN_TICKS:" + JSON.stringify(ticks));
// Both graphs compile once per build even when Bun cannot supply reusable
// observer proof. Only the coherent, nonwatching local pass may share it;
// onEnd still retires it before the next build (#1712, #1713).
const singleRoot = path.resolve("tools/bun-native-sessions");
const singleLog = path.join(singleRoot, "program-runs.bin");
const singlePlugin = ttsc({ project: path.join(singleRoot, "tsconfig.json") });
const singleTicks = [fs.existsSync(singleLog) ? fs.statSync(singleLog).size : 0];
assert.equal(singleTicks[0], 0, "the original single-entry lifetime starts cold");
for (let pass = 0; pass < 2; pass++) {
  const build = await Bun.build({
    entrypoints: [path.join(singleRoot, "src/main.ts")],
    plugins: [singlePlugin],
    target: "bun",
  });
  assert.equal(build.success, true, build.logs.join("\n"));
  assert.equal(build.outputs.length, 1);
  assert.match(await build.outputs[0].text(), /"PLUGIN"/);
  singleTicks.push(fs.statSync(singleLog).size);
  assert.equal(singleTicks[pass + 1], pass + 1, "each completed single-entry build releases its native generation");
}
console.info("TTSC_BUN_SINGLE_ENTRY_TICKS:" + JSON.stringify(singleTicks));

// Exercise the actual Turbopack loader under Bun's incomplete observer. The
// callbacks are authored consumer capabilities, not a simulated Next server.
// This reuses the same prepared native plugin and child, adding no install.
const loader = (await import("__TURBOPACK_ADAPTER__")).default;
const originalMode = process.env.NODE_ENV;
const deliverLoader = (cacheable) => new Promise((resolve, reject) => {
  const context = {
    resourcePath: path.join(singleRoot, "src/main.ts"),
    getOptions: () => ({ project: path.join(singleRoot, "tsconfig.json") }),
    async: () => (error, code) => error ? reject(error) : resolve(code),
    ...(cacheable === undefined ? {} : { cacheable }),
  };
  loader.call(context, fs.readFileSync(context.resourcePath, "utf8"));
});
try {
  process.env.NODE_ENV = "production";
  let withdrawn = 0;
  assert.match(await deliverLoader(function (enabled) {
    assert.equal(enabled, false);
    withdrawn++;
  }), /"PLUGIN"/);
  assert.equal(withdrawn, 1, "production forwards explicit nonwatching lifecycle and withdraws its host cache");
  await assert.rejects(deliverLoader(undefined), /explicitly nonwatching/);
  const failure = new Error("Turbopack host withdrawal failed");
  await assert.rejects(deliverLoader(() => { throw failure; }), error => error === failure);
  process.env.NODE_ENV = "development";
  await assert.rejects(deliverLoader(() => {}), /explicitly nonwatching/);
  console.info("TTSC_TURBOPACK_LIFECYCLES:production,missing,throwing,development");
} finally {
  if (originalMode === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalMode;
}
