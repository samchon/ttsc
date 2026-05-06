const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createProject,
  mainFile,
  mainSource,
} = require("./helpers/project.cjs");
const { loadUnpluginApi } = require("./helpers/unplugin.cjs");

test("transformTtsc accepts compilerOptions.plugins as an inline override", async () => {
  await assertTransformUsesInlineCompilerOptions();
});

async function assertTransformUsesInlineCompilerOptions() {
  const { resolveOptions, transformTtsc } = await loadUnpluginApi();
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
