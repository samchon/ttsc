const assert = require("node:assert/strict");
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

test("transformTtsc passes bundler aliases through compilerOptions.paths", async () => {
  await assertTransformPassesBundlerAliases();
});

async function assertTransformPassesBundlerAliases() {
  const root = createProject({ plugins: [] });
  const result = await transformTtsc(
    mainFile(root),
    mainSource(root),
    resolveOptions({
      plugins: [
        {
          transform: "./plugin.cjs",
          config: {
            operation: "assert-paths",
            key: "@lib",
            target: "src/modules",
          },
          name: "fixture",
        },
      ],
    }),
    { "@lib": path.join(root, "src", "modules") },
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}
