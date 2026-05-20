import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";

const esbuild = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("esbuild");

/**
 * Asserts that running a real esbuild build with the unplugin esbuild adapter
 * produces plugin-transformed output.
 *
 * Runs esbuild in-process with `write: false` and checks the first output
 * file's text for the expected plugin marker.
 */
async function assertEsbuildAdapterTransformsSource() {
  const unpluginEsbuild =
    await TestUnpluginRuntime.loadUnpluginAdapter("esbuild");
  const root = TestUnpluginProject.createProject();
  const result = await esbuild.build({
    absWorkingDir: root,
    bundle: false,
    entryPoints: ["src/main.ts"],
    format: "cjs",
    logLevel: "silent",
    plugins: [unpluginEsbuild()],
    write: false,
  });

  TestUnpluginProject.assertTransformedToPlugin(result.outputFiles[0].text);
}

export { assertEsbuildAdapterTransformsSource };
