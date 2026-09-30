import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { externalSourceModules } from "../../internal/transform-project-cache/externalSourceModules";

/**
 * Verifies a graph-free out-of-walk source output fails after the bounded
 * attempts.
 *
 * Without a graph, the host offers no compile-time proof for a source emitted
 * outside the walk, so the generation cannot prove its output coherent. Every
 * sibling must replay one terminal verdict instead of recompiling per
 * delivery.
 *
 * 1. Create a graph-free project that emits two sources under `node_modules`.
 * 2. Deliver the entry and assert it rejects after the bounded attempts.
 * 3. Deliver the external sources and assert they replay the same verdict.
 *
 * @evidence contracts/testing.md#behavioral-verification Graph-free external output rejects after two attempts with external graph-proof path; both external siblings replay exact terminal error and count remains two.
 * @evidence contracts/testing.md#independent-expectations Deliberately omitted graph proof defines refusal; error identity and native log distinguish one bounded wave from per-source retry.
 * @evidence contracts/testing.md#distinguishing-cases Two unproven sources outside walk and shared failure, contrasting proven legacy-node omission.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_unproven_out_of_walk_source_fails_after_bounded_attempts is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built transformTtsc coordinates the actual Go fixture envelope with cache delivery for two unproven sources outside walk and shared failure, contrasting proven legacy-node omission. A fabricated producer result would not establish that native proofs, output and consumer validation agree; portable helper assertions in this body still do not independently require a host.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API share native fixture artifacts through TTSC_CACHE_DIR. Its modules and request waves reuse the local generation until the stated input/proof/lifecycle changes require replacement; the compile counts above are deliberate state boundaries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. This body has no finally cache-reset guarantee; runner process exit bounds remaining observers and removes tracked roots. Cache-local seams avoid modifying another case's filesystem provider.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Graph-free external output rejects after two attempts with external graph-proof path; both external siblings replay exact terminal error and count remains two. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_unproven_out_of_walk_source_fails_after_bounded_attempts(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    externalSourceOutputs: 2,
    fileCount: 1,
  });
  const cache = createTtscTransformCache();
  const options = resolveOptions({
    project: path.join(project.root, "tsconfig.json"),
  });
  const main = path.join(project.root, "src", "mod0.ts");
  let terminal: Error | undefined;
  await assert.rejects(
    () =>
      transformTtsc(
        main,
        fs.readFileSync(main, "utf8"),
        options,
        undefined,
        cache,
      ),
    (error: Error) => {
      terminal = error;
      return (
        /after 2 attempts/.test(error.message) &&
        /external\/graph-proof-missing/.test(error.message) &&
        /node_modules\/external-source\/mod0\.ts/.test(error.message)
      );
    },
  );
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 2);
  assert.equal(cache.size, 1);
  for (const external of externalSourceModules(project.root, 2)) {
    await assert.rejects(
      () =>
        transformTtsc(
          external,
          fs.readFileSync(external, "utf8"),
          options,
          undefined,
          cache,
        ),
      (error: Error) => error === terminal,
    );
  }
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "proof-less source siblings must replay one terminal verdict",
  );
}
