const assert = require("node:assert/strict");
const test = require("node:test");

const {
  resolveOptions,
  transformTtsc,
} = require("../../packages/unplugin/lib/api.js");
const {
  createProject,
  mainFile,
  mainSource,
} = require("./helpers/project.cjs");

test("transformTtsc leaves source unchanged when plugins are disabled", async () => {
  await assertTransformSkipsProjectPlugins();
});

async function assertTransformSkipsProjectPlugins() {
  const root = createProject();
  const result = await transformTtsc(
    mainFile(root),
    mainSource(root),
    resolveOptions({ plugins: false }),
  );

  assert.equal(result, undefined);
}
