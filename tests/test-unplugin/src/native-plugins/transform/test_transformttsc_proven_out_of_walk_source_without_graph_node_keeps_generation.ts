import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { externalSourceModules } from "../../internal/transform-project-cache/externalSourceModules";

/**
 * Verifies a proven out-of-walk source output stays usable when a legacy graph
 * omits its node.
 *
 * Older hosts do not list every emitted source as a graph node. The output's
 * own compiler proof is still valid evidence, so the generation must keep
 * serving it instead of treating the missing node as an unproven input.
 *
 * 1. Create a project that emits an external source output without a graph node
 *    for it.
 * 2. Deliver the entry and the external source.
 * 3. Assert both are served from one generation.
 *
 * @evidence contracts/testing.md#behavioral-verification Main and external source outputs both deliver successfully with one compile despite omitted external graph node.
 * @evidence contracts/testing.md#independent-expectations Fixture compile log fixes one-producer expectation; only success is asserted, not exact external output text.
 * @evidence contracts/testing.md#distinguishing-cases Proven emitted source outside walk with legacy missing node, contrasting unproven graph-free refusal.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_proven_out_of_walk_source_without_graph_node_keeps_generation is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built transformTtsc coordinates the actual Go fixture envelope with cache delivery for proven emitted source outside walk with legacy missing node, contrasting unproven graph-free refusal. A fabricated producer result would not establish that native proofs, output and consumer validation agree; portable helper assertions in this body still do not independently require a host.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API share native fixture artifacts through TTSC_CACHE_DIR. Its modules and request waves reuse the local generation until the stated input/proof/lifecycle changes require replacement; the compile counts above are deliberate state boundaries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. This body has no finally cache-reset guarantee; runner process exit bounds remaining observers and removes tracked roots. Cache-local seams avoid modifying another case's filesystem provider.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Main and external source outputs both deliver successfully with one compile despite omitted external graph node. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_proven_out_of_walk_source_without_graph_node_keeps_generation(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    externalSourceOutputs: 1,
    fileCount: 2,
    graphFanout: 1,
    omitExternalSourceGraphNode: true,
  });
  const cache = createTtscTransformCache();
  const options = resolveOptions({
    project: path.join(project.root, "tsconfig.json"),
  });
  for (const file of [
    path.join(project.root, "src", "mod0.ts"),
    ...externalSourceModules(project.root, 1),
  ]) {
    assert.ok(
      await transformTtsc(
        file,
        fs.readFileSync(file, "utf8"),
        options,
        undefined,
        cache,
      ),
    );
  }
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    1,
    "the source output's compiler proof must survive an omitted graph node",
  );
}
