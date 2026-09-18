import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
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
 */
export async function test_transformttsc_unproven_out_of_walk_source_fails_after_bounded_attempts(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
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
