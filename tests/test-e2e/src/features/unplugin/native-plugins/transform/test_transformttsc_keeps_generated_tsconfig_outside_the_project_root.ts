import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies the generated tsconfig is written outside the project root.
 *
 * A file written into the project would appear in the walk, change the
 * membership digest, and invalidate the generation it belongs to, as well as
 * clutter the user's tree.
 *
 * 1. Create a project with no configured plugins.
 * 2. Transform through the fixture's `assert-temp-tsconfig-outside-project`
 *    operation.
 * 3. Assert the transform succeeds, which the operation allows only when the
 *    config lives outside the root.
 *
 * @evidence contracts/testing.md#behavioral-verification Native assert-temp-tsconfig-outside-project validates the received overlay config location and emits PLUGIN.
 * @evidence contracts/testing.md#independent-expectations The Go fixture refuses config paths inside its actual project root; acceptance and marker identify real config delivery.
 * @evidence contracts/testing.md#distinguishing-cases CompilerOptions.plugins requires a generated config even when the original tsconfig has no plugins.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_keeps_generated_tsconfig_outside_the_project_root in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Native assert-temp-tsconfig-outside-project validates the received overlay config location and emits PLUGIN. These assertions remain in test_transformttsc_keeps_generated_tsconfig_outside_the_project_root, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_keeps_generated_tsconfig_outside_the_project_root(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      compilerOptions: {
        plugins: [
          {
            transform: "./plugin.cjs",
            name: "fixture",
            operation: "assert-temp-tsconfig-outside-project",
          },
        ],
      },
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}
