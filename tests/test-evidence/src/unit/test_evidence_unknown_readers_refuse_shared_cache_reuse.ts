import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EvidenceProcessOwnership } from "../internal/EvidenceProcessOwnership";
import { pluginCacheDirectory } from "../internal/pluginCacheDirectory";

/**
 * Verifies unresolved readers block cache reuse before directory creation.
 *
 * A fixture-local refusal must also reach another fixture using the same cache.
 * Separate explicit owners keep this operation's authored state inputs from
 * poisoning the runner's shared native producer. These are direct source calls;
 * the native directory-link counterpart owns filesystem alias/retarget coverage.
 *
 * 1. Resolve a relative environment cache and its lexical nested/.. spelling.
 * 2. Register two fixtures, retain one reason and require both reuse refusals.
 * 3. Remove the cache and require refusal before recreation, while a distinct
 *    cache remains usable by the second fixture.
 * 4. Assert first-reason delegation and observable delegate failure without
 *    mutating the shared default owner or any process method.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual cache selector and an isolated actual ownership operation with real directories and environment inputs. It asserts absolute selection, lexical alias reuse, same-cache refusal, absent-path preservation, unrelated-cache admission and sticky first-reason/delegate error identity.
 * @evidence contracts/testing.md#independent-expectations Authored paths, Error sentinels and literal expected callback calls establish the oracle independently of cache-key construction; actual filesystem absence proves refusal happened before mkdir.
 * @evidence contracts/testing.md#distinguishing-cases Known readers accept reuse; an unknown first fixture blocks another fixture sharing its cache, including a removed path, while a different cache stays admitted and the original fixture stays refused. A throwing retention delegate cannot erase unknown state.
 * @evidence contracts/testing.md#execution-ownership The matching source-unit export executes the maintained source operations directly under the suite's src/unit runner. It creates ordinary filesystem inputs without native directory links, compiler, SDK preparation, process spawning or a fake product response; the callback is an explicit retention input and observes only reason delegation.
 */
export function test_evidence_unknown_readers_refuse_shared_cache_reuse(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "evidence-cache-admission-unit-"));
  const previous = process.env.TTSC_TEST_CACHE_DIR;
  const delegated: string[] = [];
  const ownership = EvidenceProcessOwnership.create((reason) => delegated.push(reason));
  const first = path.join(root, "first-fixture");
  const second = path.join(root, "second-fixture");
  const cache = path.join(root, "cache");
  const reason = new Error("Authored unresolved-reader state input.");
  try {
    process.env.TTSC_TEST_CACHE_DIR = path.relative(process.cwd(), cache);
    assert.equal(pluginCacheDirectory(first, ownership), cache);
    fs.mkdirSync(path.join(cache, "nested"));
    process.env.TTSC_TEST_CACHE_DIR = cache + path.sep + "nested" + path.sep + "..";
    assert.equal(pluginCacheDirectory(second, ownership), cache);
    ownership.retain(first, reason);
    ownership.retain(first, new Error("Later reason must not replace the first."));
    assert.deepEqual(delegated, [reason.message]);
    assert.throws(() => ownership.assertAvailable(first), { cause: reason });
    assert.throws(() => pluginCacheDirectory(second, ownership), { cause: reason });
    fs.rmSync(cache, { recursive: true });
    assert.throws(() => pluginCacheDirectory(second, ownership), { cause: reason });
    assert.equal(fs.existsSync(cache), false, "Refusal must precede cache mkdir.");
    const independent = path.join(root, "independent-cache");
    process.env.TTSC_TEST_CACHE_DIR = independent;
    assert.equal(pluginCacheDirectory(second, ownership), independent);
    assert.throws(() => pluginCacheDirectory(first, ownership), { cause: reason });

    const delegateFailure = new Error("Authored retention delegate failure.");
    const failing = EvidenceProcessOwnership.create(() => { throw delegateFailure; });
    failing.registerCache(first, independent);
    failing.retain(first, reason);
    assert.throws(() => failing.assertAvailable(first), (error: unknown) => {
      assert.ok(error instanceof Error && error.cause instanceof AggregateError);
      assert.deepEqual(error.cause.errors, [reason, delegateFailure]);
      return true;
    });
    assert.throws(() => failing.assertCacheAvailable(independent), { cause: reason });
  } finally {
    if (previous === undefined) delete process.env.TTSC_TEST_CACHE_DIR;
    else process.env.TTSC_TEST_CACHE_DIR = previous;
    // The reasons above are explicit operation inputs; no process reader exists.
    fs.rmSync(root, { recursive: true, force: true });
  }
}
