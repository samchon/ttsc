import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { samePhysicalPath } from "../../../../internal/unplugin/internal/paths/samePhysicalPath";
import { createNestedUtilityPluginProject } from "../../../../internal/unplugin/internal/transform-utility-plugin-config/createNestedUtilityPluginProject";

/**
 * Verifies a banner config appearing nearer the project than the one discovery
 * chose replaces the generation (samchon/ttsc#1271).
 *
 * Discovery walks upward and stops at the first directory that answers, so
 * every candidate it probed on the way can change the answer. Reporting only
 * the file it found leaves a cached generation unable to notice a nearer one,
 * and a cold build then disagrees with the warm one about which config the
 * project has.
 *
 * 1. Transform a project whose only banner config sits in an outer directory.
 * 2. Assert the nearer, still-absent candidate is recorded among the host inputs.
 * 3. Create the nearer config and assert the next transform uses its banner.
 *
 * @evidence contracts/testing.md#behavioral-verification Outer banner envelope records nearer absent candidate; creating it emits NEARER and removes OUTER.
 * @evidence contracts/testing.md#independent-expectations Independent outer/nearer literal texts and physical path comparison establish selection/input declaration.
 * @evidence contracts/testing.md#distinguishing-cases Higher-priority missing config candidate becomes a file while the previously selected outer config remains intact.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_persistent_banner_config_supersession_invalidates_transform in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The real linked utility plugin reads consumer configuration and produces code, completeness, graph or source-map fields consumed by the built adapter. The asserted selection/output/registration cannot be established by an in-memory config or dependency-list unit alone.
 * @evidence contracts/e2e.md#shared-execution The utility fixture seeds the workspace plugin package and shares the native Go build cache; each distinct plugin/contributor set retains its own content-keyed host artifact. This case reuses its consumer and cache across configuration/content transitions where supplied; changed config options are inputs, not repeated package installations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Outer banner envelope records nearer absent candidate; creating it emits NEARER and removes OUTER. These assertions remain in test_transformttsc_persistent_banner_config_supersession_invalidates_transform, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_persistent_banner_config_supersession_invalidates_transform(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const { middle, root } = createNestedUtilityPluginProject({
    outerConfig: JSON.stringify({ text: "OUTER BANNER" }),
    plugin: "banner",
    source: 'export const value: string = "kept";\n',
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
  assert.match(first.code, /OUTER BANNER/);
  const nearer = path.join(middle, "banner.config.json");
  const cached = (await [...cache.values()][0]!) as {
    result?: { hostInputs?: string[] };
  };
  // The declaration itself, not only its effect: the path has to be in the
  // envelope for a consumer to watch it at all, and asserting the effect alone
  // cannot tell an invalidation apart from a generation that was never
  // reusable.
  assert.ok(
    cached.result?.hostInputs?.some((input) => samePhysicalPath(input, nearer)),
    `the superseding candidate is missing from the envelope: ${JSON.stringify(cached.result?.hostInputs ?? [])}`,
  );

  fs.writeFileSync(nearer, JSON.stringify({ text: "NEARER BANNER" }), "utf8");
  const second = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(second);
  assert.match(second.code, /NEARER BANNER/);
  assert.doesNotMatch(second.code, /OUTER BANNER/);
}
