import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Asserts the generated transform tsconfig's alias encoding through the fixture
 * plugin's `assert-absolute-alias-paths` operation: the forwarded alias must
 * appear as an absolute `paths` target (TS5090 rejects bare relative targets
 * from the temp directory) and no `baseUrl` may be declared (TS5102 — the
 * option was removed in TypeScript-Go).
 */
async function assertGeneratedTsconfigOmitsBaseUrl() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      plugins: [
        {
          transform: "./plugin.cjs",
          config: {
            operation: "assert-absolute-alias-paths",
            key: "@lib",
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

export { assertGeneratedTsconfigOmitsBaseUrl };
