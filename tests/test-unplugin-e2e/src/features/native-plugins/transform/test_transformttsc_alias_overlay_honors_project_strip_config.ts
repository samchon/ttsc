import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { STRIP_CONFIG } from "../../../internal/transform-utility-plugin-config/STRIP_CONFIG";
import { STRIP_SOURCE } from "../../../internal/transform-utility-plugin-config/STRIP_SOURCE";
import { aliasFor } from "../../../internal/transform-utility-plugin-config/aliasFor";
import { createUtilityPluginProject } from "../../../internal/transform-utility-plugin-config/createUtilityPluginProject";

/**
 * Verifies a bundler alias does not detach `@ttsc/strip` from the project's
 * `strip.config.json`.
 *
 * Under an alias the compile runs through a generated tsconfig in a temp
 * directory. If the plugin lost the project's config there, it would silently
 * fall back to its built-in defaults and strip different calls.
 *
 * 1. Create a strip project with a `strip.config.json`.
 * 2. Transform its entry with a bundler alias.
 * 3. Assert the configured call is removed and the default-only call is kept.
 *
 * @evidence contracts/testing.md#behavioral-verification A real strip utility under the alias wrapper must remove logger.trace("drop") and preserve console.log("kept"), distinguishing project configuration from built-in defaults.
 * @evidence contracts/testing.md#independent-expectations STRIP_CONFIG explicitly selects logger.trace while STRIP_SOURCE contains both calls. Literal positive and negative regex assertions encode the desired change and preserved call independently of strip output generation.
 * @evidence contracts/testing.md#distinguishing-cases The configured drop call and default-only console call share one source, so using defaults or leaving all calls unchanged both fail. The no-alias equivalence and hostile-temp variants are distinct complementary entries.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_alias_overlay_honors_project_strip_config in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The generated JS tsconfig wrapper and real first-party native utility host must preserve project-based config discovery. Direct config parsing cannot detect the compiler/plugin using the temporary wrapper directory as its discovery root.
 * @evidence contracts/e2e.md#shared-execution createUtilityPluginProject allocates this consumer and seeds the existing first-party plugin; native producer/build preparation is shared through TestUnpluginProject. The aliasFor map changes generated wrapper input while keeping the authored source/config identity fixed; no separate installation is needed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The utility consumer has a unique root and config paths, and this entry leaves shared producer source intact. Uncached transform invocations do not borrow another entry's generation; TestProject owns temporary consumer and wrapper directories through runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_alias_overlay_honors_project_strip_config; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_alias_overlay_honors_project_strip_config(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: { "strip.config.json": STRIP_CONFIG },
    plugin: "strip",
    source: STRIP_SOURCE,
  });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
    aliasFor(root),
  );

  assert.ok(result);
  assert.doesNotMatch(result.code, /logger\.trace\("drop"\)/);
  // The defaults strip console.log; the project config must win instead.
  assert.match(result.code, /console\.log\("kept"\)/);
}
