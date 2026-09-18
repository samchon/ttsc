import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies the generated tsconfig encodes aliases as absolute `paths` targets
 * and declares no `baseUrl`.
 *
 * The generated tsconfig lives in the temp directory, where TypeScript-Go
 * rejects bare relative `paths` targets (TS5090). `baseUrl` was removed in
 * TypeScript-Go (TS5102), so declaring it would fail every compile that
 * forwards an alias.
 *
 * 1. Create a project with no configured plugins.
 * 2. Transform with a bundler alias through the fixture's
 *    `assert-absolute-alias-paths` operation.
 * 3. Assert the transform succeeds, which the operation allows only for an
 *    absolute target without `baseUrl`.
 */
export async function test_transformttsc_generated_tsconfig_omits_baseurl_and_uses_absolute_alias_targets(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      // Options sit at the entry top level: the protocol forwards the whole
      // plugins[i] entry as the plugin's config object, and a nested
      // `config: {...}` would silently fall back to the default operation.
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "fixture",
          operation: "assert-absolute-alias-paths",
          key: "@lib",
        },
      ],
    }),
    { "@lib": path.join(root, "src", "modules") },
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}
