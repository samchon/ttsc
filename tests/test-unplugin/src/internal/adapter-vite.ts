import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import path from "node:path";

const { build: viteBuild } = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("vite");

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
