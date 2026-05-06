const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createProject,
  mainFile,
  mainSource,
} = require("./helpers/project.cjs");
const { loadUnpluginApi } = require("./helpers/unplugin.cjs");

test("transformTtsc leaves source unchanged when plugins are disabled", async () => {
  await assertTransformSkipsProjectPlugins();
});

async function assertTransformSkipsProjectPlugins() {
  const { resolveOptions, transformTtsc } = await loadUnpluginApi();
  const root = createProject({
    source: 'export const value: string = "plugin";\n',
  });
  const result = await transformTtsc(
    mainFile(root),
    mainSource(root),
    resolveOptions({ plugins: false }),
  );

  assert.equal(result, undefined);
}
