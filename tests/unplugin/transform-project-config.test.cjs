const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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

test("transformTtsc reads plugins from the discovered tsconfig", async () => {
  await assertTransformReadsDiscoveredTsconfig();
});

async function assertTransformReadsDiscoveredTsconfig() {
  const root = createProject();
  const result = await transformTtsc(
    mainFile(root),
    mainSource(root),
    resolveOptions(),
  );

  assert.ok(result);
  assert.match(result.code, /export const value = "PLUGIN"/);
  assert.doesNotMatch(result.code, /goUpper/);
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
}
