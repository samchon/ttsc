import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import path from "node:path";

const viteBuild = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("vite").build;

/**
 * Verifies a real Vite build transforms through the adapter.
 *
 * This is the Vite adapter's end-to-end contract. The build runs with `write:
 * false` and a silent log level, so it touches nothing on disk and every chunk
 * can be inspected in memory.
 *
 * 1. Build the project's entry with the Vite adapter.
 * 2. Collect the code of every output chunk.
 * 3. Assert the chunks carry the transformed marker.
 */
export async function test_vite_adapter_runs_the_configured_ttsc_source_transform(): Promise<void> {
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
