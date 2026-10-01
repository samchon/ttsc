import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../internal/transform-project-cache/createCacheProject";

/**
 * Verifies concurrent transforms of one module compile the project once.
 *
 * Eviction on failure must not weaken the single-flight guarantee: two callers
 * racing for the same key share the one in-flight generation stored in the
 * cache.
 *
 * 1. Create a single-module project that counts its compiles.
 * 2. Transform the module twice concurrently through one cache.
 * 3. Assert both succeed and the project compiled once.
 *
 * @evidence contracts/testing.md#behavioral-verification Two simultaneous same-module transforms both return PROBED with one compile.
 * @evidence contracts/testing.md#independent-expectations Fixture marker and native one-byte run log distinguish correct shared production from two successful separate compiles.
 * @evidence contracts/testing.md#distinguishing-cases Singleton project with two equal in-flight requests.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_shares_one_compile_across_concurrent_callers is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built transformTtsc coordinates the actual Go fixture envelope with cache delivery for singleton project with two equal in-flight requests. A fabricated producer result would not establish that native proofs, output and consumer validation agree; portable helper assertions in this body still do not independently require a host.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API share native fixture artifacts through TTSC_CACHE_DIR. Its modules and request waves reuse the local generation until the stated input/proof/lifecycle changes require replacement; the compile counts above are deliberate state boundaries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. This body has no finally cache-reset guarantee; runner process exit bounds remaining observers and removes tracked roots. Cache-local seams avoid modifying another case's filesystem provider.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Two simultaneous same-module transforms both return PROBED with one compile. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_shares_one_compile_across_concurrent_callers(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 1 });
  const cache = createTtscTransformCache();
  const file = path.join(project.root, "src", "mod0.ts");
  const source = fs.readFileSync(file, "utf8");
  const options = resolveOptions();

  const [first, second] = await Promise.all([
    transformTtsc(file, source, options, undefined, cache),
    transformTtsc(file, source, options, undefined, cache),
  ]);
  assert.ok(first);
  assert.ok(second);
  assert.match(first.code, /PROBED/);
  assert.match(second.code, /PROBED/);

  const pluginRuns = fs.existsSync(project.runLog)
    ? fs.readFileSync(project.runLog, "utf8").length
    : 0;
  assert.equal(pluginRuns, 1, "concurrent callers must share one compile");
}
