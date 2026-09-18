import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createNestedUtilityPluginProject } from "../../internal/transform-utility-plugin-config/createNestedUtilityPluginProject";

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
    cached.result?.hostInputs?.some(
      (input) => path.resolve(input) === path.resolve(nearer),
    ),
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
