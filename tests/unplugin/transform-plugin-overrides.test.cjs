const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createProject,
  mainFile,
  mainSource,
} = require("./helpers/project.cjs");
const { loadUnpluginApi } = require("./helpers/unplugin.cjs");

test("transformTtsc applies top-level plugin overrides in order", async () => {
  await assertTransformAppliesOrderedPluginOverrides();
});

async function assertTransformAppliesOrderedPluginOverrides() {
  const { resolveOptions, transformTtsc } = await loadUnpluginApi();
  const root = createProject({ plugins: [] });
  const result = await transformTtsc(
    mainFile(root),
    mainSource(root),
    resolveOptions({
      plugins: [
        { transform: "./plugin.cjs", name: "prefix", prefix: "A:" },
        { transform: "./plugin.cjs", name: "upper" },
        { transform: "./plugin.cjs", name: "suffix", suffix: ":Z" },
      ],
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"A:PLUGIN:Z"/);
}
