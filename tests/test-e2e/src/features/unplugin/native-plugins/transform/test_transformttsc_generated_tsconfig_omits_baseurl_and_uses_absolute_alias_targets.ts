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
 *
 * @evidence contracts/testing.md#behavioral-verification Native assert-absolute-alias-paths accepts the generated config and returns PLUGIN.
 * @evidence contracts/testing.md#independent-expectations The fixture Go operation explicitly refuses relative target or baseUrl; its configured alias key is independent of adapter option generation.
 * @evidence contracts/testing.md#distinguishing-cases Bundler alias reaches a temporary config whose directory differs from the consumer; success requires absolute paths and no removed baseUrl option.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_generated_tsconfig_omits_baseurl_and_uses_absolute_alias_targets in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Native assert-absolute-alias-paths accepts the generated config and returns PLUGIN. These assertions remain in test_transformttsc_generated_tsconfig_omits_baseurl_and_uses_absolute_alias_targets, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
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
