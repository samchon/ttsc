import { TestUnpluginProject } from "@ttsc/testing/unplugin/project";
import { TestUnpluginRuntime } from "@ttsc/testing/unplugin/unplugin";

const esbuild = TestUnpluginProject.requireFromUnplugin("esbuild");

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
