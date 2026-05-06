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

test("transformTtsc accepts compilerOptions.plugins as an inline override", async () => {
  await assertTransformUsesInlineCompilerOptions();
});

async function assertTransformUsesInlineCompilerOptions() {
  const root = createProject({ plugins: [] });
  const result = await transformTtsc(
    mainFile(root),
    mainSource(root),
    resolveOptions({
      compilerOptions: {
        plugins: [{ transform: "./plugin.cjs", name: "fixture" }],
      },
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}
