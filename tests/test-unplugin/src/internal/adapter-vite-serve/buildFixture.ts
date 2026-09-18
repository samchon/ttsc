import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";

import type { IViteServeCandidateFixture } from "./IViteServeCandidateFixture";

const viteBuild: (config: object) => Promise<unknown> =
  TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("vite").build;

/** Run a production Vite build over the fixture and return its chunk code. */
export async function buildFixture(
  fixture: IViteServeCandidateFixture,
): Promise<string> {
  const unpluginVite = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  const output: any = await viteBuild({
    build: {
      minify: false,
      rollupOptions: { input: fixture.mainFile },
      write: false,
    },
    configFile: false,
    logLevel: "silent",
    plugins: [unpluginVite()],
    root: fixture.app,
  });
  const chunks = Array.isArray(output)
    ? output.flatMap((entry: any) => entry.output)
    : output.output;
  return TestUnpluginProject.collectRollupOutputCode(chunks);
}
