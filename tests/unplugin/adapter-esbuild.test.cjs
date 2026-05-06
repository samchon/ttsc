const assert = require("node:assert/strict");
const test = require("node:test");

const unpluginEsbuild =
  require("../../packages/unplugin/lib/esbuild.js").default;
const {
  assertTransformedToPlugin,
  createProject,
  requireFromUnplugin,
} = require("./helpers/project.cjs");

const esbuild = requireFromUnplugin("esbuild");

test("esbuild adapter runs the configured ttsc source transform", async () => {
  await assertEsbuildAdapterTransformsSource();
});

async function assertEsbuildAdapterTransformsSource() {
  const root = createProject();
  const result = await esbuild.build({
    absWorkingDir: root,
    bundle: false,
    entryPoints: ["src/main.ts"],
    format: "cjs",
    logLevel: "silent",
    plugins: [unpluginEsbuild()],
    write: false,
  });

  assertTransformedToPlugin(result.outputFiles[0].text);
}
