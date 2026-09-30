import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { createTickPinnedFilesystem } from "../../internal/transform-project-cache/createTickPinnedFilesystem";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a same-tick, same-length rewrite of a universal input still replaces
 * the generation.
 *
 * The universal inputs, `tsconfig.json`, plugin descriptors, and package
 * manifests, are the ones tooling rewrites in place. A capture-time signature
 * for a stamp whose tick the clock has not provably left would let such a
 * rewrite replay stale output.
 *
 * 1. Compile through a tick-pinned filesystem with silent watches.
 * 2. Rewrite a universal input in place with the same length.
 * 3. Assert the next delivery replaces the generation.
 *
 * @evidence contracts/testing.md#behavioral-verification Reordered same-length package manifest under pinned tick replaces generation and increments compile count one to two.
 * @evidence contracts/testing.md#independent-expectations Authored changed JSON bytes plus pinned signatures isolate universal content validation, despite same semantic object.
 * @evidence contracts/testing.md#distinguishing-cases Universal package input changed bytes with all metadata unchanged.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_same_tick_universal_rewrite_replaces_the_generation is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built transformTtsc coordinates the actual Go fixture envelope with cache delivery for universal package input changed bytes with all metadata unchanged. A fabricated producer result would not establish that native proofs, output and consumer validation agree; portable helper assertions in this body still do not independently require a host.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API share native fixture artifacts through TTSC_CACHE_DIR. Its modules and request waves reuse the local generation until the stated input/proof/lifecycle changes require replacement; the compile counts above are deliberate state boundaries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. This body has no finally cache-reset guarantee; runner process exit bounds remaining observers and removes tracked roots. Cache-local seams avoid modifying another case's filesystem provider.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Reordered same-length package manifest under pinned tick replaces generation and increments compile count one to two. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_same_tick_universal_rewrite_replaces_the_generation(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 4, graphFanout: 4 });
  const modules = projectModules(project.root);
  const pinned = createTickPinnedFilesystem({
    device: fs.lstatSync(project.root, { bigint: true }).dev,
    watch: "silent",
  });
  const cache = createTtscTransformCache(pinned.operations);
  const options = resolveOptions();
  const deliver = (file: string) =>
    transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
  const pluginRuns = (): number =>
    fs.existsSync(project.runLog)
      ? fs.readFileSync(project.runLog, "utf8").length
      : 0;

  for (const file of modules) {
    assert.ok(await deliver(file));
  }
  assert.equal(pluginRuns(), 1);
  const firstGeneration = [...cache.values()][0];

  // Same bytes reordered: the length, and with the pinned tick every stamp,
  // survive the rewrite untouched.
  fs.writeFileSync(
    path.join(project.root, "package.json"),
    JSON.stringify({ type: "commonjs", private: true }, null, 2),
    "utf8",
  );
  assert.ok(await deliver(modules[0]!));
  assert.notEqual(
    [...cache.values()][0],
    firstGeneration,
    "a same-tick rewrite of a universal input must replace the generation",
  );
  assert.equal(pluginRuns(), 2);
}
