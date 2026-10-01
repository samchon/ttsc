import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createProjectWithExternalInput } from "../../../internal/transform-external/createProjectWithExternalInput";

/**
 * Verifies a persistent cache invalidates when a reported out-of-walk input
 * changes.
 *
 * The plugin reads a file outside the project root and reports it as a
 * dependency. No `buildStart` clear happens between transforms, so only
 * external-input validation can notice the edit.
 *
 * 1. Transform with a plugin that reads and reports a file outside the project.
 * 2. Edit only that file.
 * 3. Transform again through the same cache and assert the output is regenerated.
 *
 * @evidence contracts/testing.md#behavioral-verification Reported external helper edit refreshes output from PLUGIN:FIRST to PLUGIN:SECOND without clearing cache.
 * @evidence contracts/testing.md#independent-expectations Native read-configured-helper and literal external bytes define output independently; dependency reporter explicitly owns that path.
 * @evidence contracts/testing.md#distinguishing-cases Outside-root dependency changes while module/descriptor remain fixed, contrasting undeclared graph members under completeness.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_invalidates_project_cache_when_an_external_input_changes in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Reported external helper edit refreshes output from PLUGIN:FIRST to PLUGIN:SECOND without clearing cache. These assertions remain in test_transformttsc_invalidates_project_cache_when_an_external_input_changes, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_invalidates_project_cache_when_an_external_input_changes(): Promise<void> {
  const { resolveOptions, transformTtsc, createTtscTransformCache } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const { external, relative, root } =
    createProjectWithExternalInput("first\n");
  const options = resolveOptions({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "reader",
        operation: "read-configured-helper",
        path: relative,
      },
      {
        transform: "./plugin.cjs",
        name: "reporter",
        operation: "emit-dependencies",
        dependencies: [relative],
      },
    ],
  });
  const cache = createTtscTransformCache();

  const before = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(before);
  assert.match(before.code, /PLUGIN:FIRST/);

  fs.writeFileSync(external, "second\n", "utf8");
  const after = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(after);
  assert.match(after.code, /PLUGIN:SECOND/);
}
