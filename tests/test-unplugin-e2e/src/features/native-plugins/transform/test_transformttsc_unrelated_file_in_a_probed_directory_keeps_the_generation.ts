import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createNestedUtilityPluginProject } from "../../../internal/transform-utility-plugin-config/createNestedUtilityPluginProject";

/**
 * Verifies an unrelated file in a directory discovery probed does not
 * invalidate anything.
 *
 * This is the twin of the supersession case. The probes make a set of paths
 * matter, and a generation that woke for any neighbour of them would trade one
 * defect for a worse one, since config directories carry ordinary traffic.
 *
 * 1. Transform a project whose banner config was found above a probed middle
 *    directory.
 * 2. Create an unrelated file in the probed directory.
 * 3. Transform again and assert the generation is kept.
 *
 * @evidence contracts/testing.md#behavioral-verification Creating unrelated.json beside config probes retains same generation and OUTER BANNER output.
 * @evidence contracts/testing.md#independent-expectations Configured outer banner literal and unchanged promise identity independently establish no supersession.
 * @evidence contracts/testing.md#distinguishing-cases Unrecorded neighbor creation versus actual config-candidate supersession.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_unrelated_file_in_a_probed_directory_keeps_the_generation is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built transformTtsc coordinates the actual Go fixture envelope with cache delivery for unrecorded neighbor creation versus actual config-candidate supersession. A fabricated producer result would not establish that native proofs, output and consumer validation agree; portable helper assertions in this body still do not independently require a host.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API share native fixture artifacts through TTSC_CACHE_DIR. Its modules and request waves reuse the local generation until the stated input/proof/lifecycle changes require replacement; the compile counts above are deliberate state boundaries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. This body has no finally cache-reset guarantee; runner process exit bounds remaining observers and removes tracked roots. Cache-local seams avoid modifying another case's filesystem provider.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Creating unrelated.json beside config probes retains same generation and OUTER BANNER output. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_unrelated_file_in_a_probed_directory_keeps_the_generation(): Promise<void> {
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
  const firstGeneration = [...cache.values()][0];

  fs.writeFileSync(
    path.join(middle, "unrelated.json"),
    JSON.stringify({ text: "IGNORED" }),
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
  assert.equal(
    [...cache.values()][0],
    firstGeneration,
    "a neighbour of a probed candidate must not replace the generation",
  );
  assert.match(second.code, /OUTER BANNER/);
}
