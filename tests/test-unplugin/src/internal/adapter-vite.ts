import path from "node:path";
import { TestUnpluginProject } from "@ttsc/testing/unplugin/project";
import { TestUnpluginRuntime } from "@ttsc/testing/unplugin/unplugin";

const { build: viteBuild } = TestUnpluginProject.requireFromUnplugin("vite");

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
