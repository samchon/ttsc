const path = require("node:path");
const test = require("node:test");

const {
  assertTransformedToPlugin,
  collectRollupOutputCode,
  createProject,
  requireFromUnplugin,
} = require("./helpers/project.cjs");
const { loadUnpluginAdapter } = require("./helpers/unplugin.cjs");

const { build: viteBuild } = requireFromUnplugin("vite");

test("vite adapter runs the configured ttsc source transform", async () => {
  await assertViteAdapterTransformsSource();
});

async function assertViteAdapterTransformsSource() {
  const unpluginVite = await loadUnpluginAdapter("vite");
  const root = createProject();
  const output = await viteBuild({
    root,
    build: {
      minify: false,
      rollupOptions: {
        input: path.join(root, "src", "main.ts"),
      },
      write: false,
    },
    logLevel: "silent",
    plugins: [unpluginVite()],
  });

  const chunks = Array.isArray(output)
    ? output.flatMap((entry) => entry.output)
    : output.output;
  assertTransformedToPlugin(collectRollupOutputCode(chunks));
}
