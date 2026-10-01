import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { STRIP_CONFIG } from "../../../internal/transform-utility-plugin-config/STRIP_CONFIG";
import { STRIP_SOURCE } from "../../../internal/transform-utility-plugin-config/STRIP_SOURCE";
import { createNestedUtilityPluginProject } from "../../../internal/transform-utility-plugin-config/createNestedUtilityPluginProject";

/**
 * Verifies a strip config that appears where discovery found none replaces the
 * built-in defaults.
 *
 * `@ttsc/strip` falls back to its built-in defaults when no config exists
 * anywhere up the tree, which is the state a config appearing later changes.
 * The defaults strip `console.log` while the planted config strips
 * `logger.trace` instead, so each direction of the assertion tells "the new
 * config took effect" apart from "the defaults kept running".
 *
 * 1. Transform a strip project with no config and assert the defaults applied.
 * 2. Create a config in a directory discovery probed.
 * 3. Transform again and assert the new config applied instead of the defaults.
 *
 * @evidence contracts/testing.md#behavioral-verification Without config strip removes console.log and preserves logger.trace; an appearing config reverses both outcomes.
 * @evidence contracts/testing.md#independent-expectations Handwritten STRIP_SOURCE and config select opposite call targets, providing intended changes and preservation controls.
 * @evidence contracts/testing.md#distinguishing-cases Missing config defaults versus discovered config is a real selection transition; source remains fixed.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_persistent_strip_defaults_yield_to_an_appearing_config in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The real linked utility plugin reads consumer configuration and produces code, completeness, graph or source-map fields consumed by the built adapter. The asserted selection/output/registration cannot be established by an in-memory config or dependency-list unit alone.
 * @evidence contracts/e2e.md#shared-execution The utility fixture seeds the workspace plugin package and shares the native Go build cache; each distinct plugin/contributor set retains its own content-keyed host artifact. This case reuses its consumer and cache across configuration/content transitions where supplied; changed config options are inputs, not repeated package installations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Without config strip removes console.log and preserves logger.trace; an appearing config reverses both outcomes. These assertions remain in test_transformttsc_persistent_strip_defaults_yield_to_an_appearing_config, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_persistent_strip_defaults_yield_to_an_appearing_config(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const { middle, root } = createNestedUtilityPluginProject({
    plugin: "strip",
    source: STRIP_SOURCE,
  });
  const file = path.join(root, "src", "main.ts");
  const source = fs.readFileSync(file, "utf8");
  const cache = createTtscTransformCache();
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(first);
  assert.doesNotMatch(first.code, /console\.log\("kept"\)/);
  assert.match(first.code, /logger\.trace\("drop"\)/);

  fs.writeFileSync(
    path.join(middle, "strip.config.json"),
    STRIP_CONFIG,
    "utf8",
  );
  const second = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(second);
  assert.doesNotMatch(second.code, /logger\.trace\("drop"\)/);
  assert.match(second.code, /console\.log\("kept"\)/);
}
