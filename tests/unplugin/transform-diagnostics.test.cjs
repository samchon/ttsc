const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createProject,
  mainFile,
  mainSource,
} = require("./helpers/project.cjs");
const { loadUnpluginApi } = require("./helpers/unplugin.cjs");

test("transformTtsc reports native transform diagnostics", async () => {
  await assertTransformReportsNativeDiagnostics();
});

async function assertTransformReportsNativeDiagnostics() {
  const { resolveOptions, transformTtsc } = await loadUnpluginApi();
  const root = createProject({
    source: 'export const value: string = "plain";\n',
  });

  await assert.rejects(
    () => transformTtsc(mainFile(root), mainSource(root), resolveOptions()),
    /expected export const value = goUpper/,
  );
}
