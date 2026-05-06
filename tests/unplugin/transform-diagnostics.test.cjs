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

test("transformTtsc reports native transform diagnostics", async () => {
  await assertTransformReportsNativeDiagnostics();
});

async function assertTransformReportsNativeDiagnostics() {
  const root = createProject({
    source: 'export const value: string = "plain";\n',
  });

  await assert.rejects(
    () => transformTtsc(mainFile(root), mainSource(root), resolveOptions()),
    /expected export const value = goUpper/,
  );
}
