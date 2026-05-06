const assert = require("node:assert/strict");
const test = require("node:test");

const { loadUnpluginApi } = require("./helpers/unplugin.cjs");

test("transformTtsc ignores bundler virtual modules", async () => {
  await assertTransformIgnoresVirtualModules();
});

async function assertTransformIgnoresVirtualModules() {
  const { resolveOptions, transformTtsc } = await loadUnpluginApi();
  const result = await transformTtsc(
    "\0rolldown/runtime.js",
    "export {};",
    resolveOptions(),
  );

  assert.equal(result, undefined);
}
