import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import path from "node:path";

const { build: viteBuild } = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("vite");

/**
 * Asserts that running a real Vite build with the unplugin vite adapter
 * produces plugin-transformed output.
 *
 * Runs Vite with `write: false` and `logLevel: "silent"` so no files are
 * written and console output is suppressed; collects all chunk code via the
 * shared helper.
 */
async function assertViteAdapterTransformsSource() {
  const unpluginVite = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  const root = TestUnpluginProject.createProject();
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
  TestUnpluginProject.assertTransformedToPlugin(
    TestUnpluginProject.collectRollupOutputCode(chunks),
  );
}

export { assertViteAdapterTransformsSource };
