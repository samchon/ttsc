import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createUtilityPluginProject } from "../../internal/transform-utility-plugin-config/createUtilityPluginProject";

/**
 * Verifies a persistent generation reloads a config the plugin discovered
 * implicitly.
 *
 * `@ttsc/banner` finds `banner.config.json` itself; the tsconfig never names
 * it. The discovered file is still a host input, so editing it must replace a
 * persistent generation rather than keep serving the old banner.
 *
 * 1. Transform a banner project whose config says `OLD BANNER`.
 * 2. Rewrite the config to `NEW BANNER`.
 * 3. Transform again through the same cache and assert only the new banner
 *    appears.
 *
 * @evidence contracts/testing.md#behavioral-verification Native banner config edit replaces OLD BANNER with NEW BANNER through an existing cache.
 * @evidence contracts/testing.md#independent-expectations Literal handwritten config text establishes old/new output independently of discovery and hashing.
 * @evidence contracts/testing.md#distinguishing-cases Implicitly discovered selected config changes without modifying tsconfig or entry source.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_persistent_banner_config_edit_invalidates_transform in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The real linked utility plugin reads consumer configuration and produces code, completeness, graph or source-map fields consumed by the built adapter. The asserted selection/output/registration cannot be established by an in-memory config or dependency-list unit alone.
 * @evidence contracts/e2e.md#shared-execution The utility fixture seeds the workspace plugin package and shares the native Go build cache; each distinct plugin/contributor set retains its own content-keyed host artifact. This case reuses its consumer and cache across configuration/content transitions where supplied; changed config options are inputs, not repeated package installations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Native banner config edit replaces OLD BANNER with NEW BANNER through an existing cache. These assertions remain in test_transformttsc_persistent_banner_config_edit_invalidates_transform, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_persistent_banner_config_edit_invalidates_transform(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: {
      "banner.config.json": JSON.stringify({ text: "OLD BANNER" }),
    },
    plugin: "banner",
    source: 'export const value: string = "kept";\n',
  });
  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  const cache = createTtscTransformCache();
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(first);
  assert.match(first.code, /OLD BANNER/);

  fs.writeFileSync(
    path.join(root, "banner.config.json"),
    JSON.stringify({ text: "NEW BANNER" }),
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
  assert.match(second.code, /NEW BANNER/);
  assert.doesNotMatch(second.code, /OLD BANNER/);
}
