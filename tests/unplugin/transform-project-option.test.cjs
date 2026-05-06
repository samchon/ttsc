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

test("transformTtsc uses the project option for an alternate tsconfig", async () => {
  await assertTransformUsesProjectOption();
});

async function assertTransformUsesProjectOption() {
  const root = createProject({ plugins: [] });
  fs.writeFileSync(
    path.join(root, "tsconfig.unplugin.json"),
    JSON.stringify(
      {
        extends: "./tsconfig.json",
        compilerOptions: {
          plugins: [{ transform: "./plugin.cjs", name: "fixture" }],
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  const result = await transformTtsc(
    mainFile(root),
    mainSource(root),
    resolveOptions({
      project: path.join(root, "tsconfig.unplugin.json"),
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}
