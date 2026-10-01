import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { STRIP_CONFIG } from "../../../../internal/unplugin/internal/transform-utility-plugin-config/STRIP_CONFIG";
import { STRIP_SOURCE } from "../../../../internal/unplugin/internal/transform-utility-plugin-config/STRIP_SOURCE";
import { aliasFor } from "../../../../internal/unplugin/internal/transform-utility-plugin-config/aliasFor";
import { createUtilityPluginProject } from "../../../../internal/unplugin/internal/transform-utility-plugin-config/createUtilityPluginProject";

/**
 * Verifies the strip output is byte-identical with and without a bundler alias.
 *
 * The alias lane compiles through a generated tsconfig and the plain lane
 * through the project's own. Both must read the same strip config, or the same
 * source would bundle differently depending on whether an alias was
 * configured.
 *
 * 1. Create a strip project with a `strip.config.json`.
 * 2. Transform its entry with and without a bundler alias.
 * 3. Assert the configured call is removed and the two outputs are identical.
 *
 * @evidence contracts/testing.md#behavioral-verification Real strip transformations of the same source with and without an alias must both return results, the plain output must remove logger.trace, and the two outputs must be byte-identical.
 * @evidence contracts/testing.md#independent-expectations Literal removal checks the configured transformation independently. Equality alone would allow both routes to be wrong, so that removal anchors the shared-result oracle; this entry does not separately require console.log preservation, which the project-strip entry does.
 * @evidence contracts/testing.md#distinguishing-cases Alias-generated wrapper versus direct authored tsconfig are compared on identical source/config. The adjacent project-strip and hostile-temp entries provide preserved-call and incorrect-discovery-root distinctions.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_alias_overlay_matches_no_alias_strip_output in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The generated JS tsconfig wrapper and real first-party native utility host must preserve project-based config discovery. Direct config parsing cannot detect the compiler/plugin using the temporary wrapper directory as its discovery root.
 * @evidence contracts/e2e.md#shared-execution createUtilityPluginProject allocates this consumer and seeds the existing first-party plugin; native producer/build preparation is shared through TestUnpluginProject. The aliasFor map changes generated wrapper input while keeping the authored source/config identity fixed; no separate installation is needed. Two native captures are necessary because the wrapper and direct-tsconfig routes differ and neither is served from a supplied cache.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The utility consumer has a unique root and config paths, and this entry leaves shared producer source intact. Uncached transform invocations do not borrow another entry's generation; TestProject owns temporary consumer and wrapper directories through runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_alias_overlay_matches_no_alias_strip_output; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_alias_overlay_matches_no_alias_strip_output(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: { "strip.config.json": STRIP_CONFIG },
    plugin: "strip",
    source: STRIP_SOURCE,
  });
  const withAlias = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
    aliasFor(root),
  );
  const withoutAlias = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
  );

  assert.ok(withAlias);
  assert.ok(withoutAlias);
  assert.doesNotMatch(withoutAlias.code, /logger\.trace\("drop"\)/);
  assert.equal(withAlias.code, withoutAlias.code);
}
