import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EvidenceProcessOwnership } from "../../../utils/src/evidence/EvidenceProcessOwnership";
import { linkDirectory } from "../../../utils/src/evidence/linkDirectory";
import { pluginCacheDirectory } from "../../../utils/src/evidence/pluginCacheDirectory";

/**
 * Verifies cache admission stays refused for a used cache path and link spelling after retargeting and replacement.
 *
 * The case creates a real directory link (junction on Windows) and registers both
 * the cache path and the link path for the first fixture through the cache
 * selector, so the registry holds each spelling and the native identity of the
 * linked directory. It does not prepare a compiler or supply a synthetic SDK or
 * native protocol response.
 *
 * 1. Link one actual cache, then resolve the cache path and the link path for the
 *    first fixture.
 * 2. Retain the authored unknown-reader state and refuse a second fixture that
 *    selects either the used link path or a newly created alias of that cache.
 * 3. Retarget the link at another directory, refuse the link spelling again and
 *    admit the other directory by its own path.
 * 4. Delete and recreate the original cache directory and require its path to stay
 *    refused.
 *
 * @evidence contracts/testing.md#behavioral-verification Uses real directory links, native realpath and directory deletion/recreation with the actual pluginCacheDirectory and EvidenceProcessOwnership operations. After the first fixture retains an unknown-reader reason, a second fixture is refused for both the used link spelling and a newly created alias, still refused after the used link is retargeted, admitted for the unrelated target directory, and refused for the recreated original cache path.
 * @evidence contracts/testing.md#independent-expectations Authored paths and fs.realpathSync.native observations establish the linked directory independently of the registry's keys. The new alias is created only after retention and was never registered for the first fixture, so its refusal requires physical-path or native-identity admission rather than matching a previously used spelling. Unchanged sentinel bytes prove refusal did not delete cache content, and replacement bytes are read back.
 * @evidence contracts/testing.md#distinguishing-cases Refused: the previously used link, a never-used alias of the retained cache, and the recreated original path. Admitted: the unrelated `other` directory under its own path. Retargeting the used link must preserve its refusal without blocking its new target under an independent spelling. There is no Windows permission skip.
 * @evidence contracts/testing.md#execution-ownership The matching src/features export is discovered by the unit runner and central function claim. It executes actual native filesystem identity/link operations in that Node process; no CLI, Go binary, installer or additional product host is created.
 */
export function test_evidence_unknown_reader_cache_identity_blocks_native_alias_reuse(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "evidence-native-cache-identity-"));
  const previous = process.env.TTSC_TEST_CACHE_DIR;
  const cache = path.join(root, "cache");
  const other = path.join(root, "other");
  const alias = path.join(root, "alias");
  const freshAlias = path.join(root, "fresh-alias");
  const delegated: string[] = [];
  const ownership = EvidenceProcessOwnership.create((reason) => delegated.push(reason));
  const first = path.join(root, "first-fixture");
  const second = path.join(root, "second-fixture");
  const reason = new Error("Authored unresolved-reader identity input.");
  try {
    fs.mkdirSync(cache);
    fs.mkdirSync(other);
    fs.writeFileSync(path.join(cache, "sentinel"), "original bytes");
    linkDirectory(cache, alias);
    assert.equal(fs.realpathSync.native(alias), fs.realpathSync.native(cache));
    process.env.TTSC_TEST_CACHE_DIR = cache;
    assert.equal(pluginCacheDirectory(first, ownership), cache);
    process.env.TTSC_TEST_CACHE_DIR = alias;
    assert.equal(pluginCacheDirectory(first, ownership), alias);
    ownership.retain(first, reason);
    linkDirectory(cache, freshAlias);
    assert.equal(fs.realpathSync.native(freshAlias), fs.realpathSync.native(cache));
    process.env.TTSC_TEST_CACHE_DIR = freshAlias;
    assert.throws(() => pluginCacheDirectory(second, ownership), { cause: reason });
    fs.unlinkSync(freshAlias);
    process.env.TTSC_TEST_CACHE_DIR = alias;
    assert.throws(() => pluginCacheDirectory(second, ownership), { cause: reason });
    assert.equal(fs.readFileSync(path.join(cache, "sentinel"), "utf8"), "original bytes");
    fs.unlinkSync(alias);
    linkDirectory(other, alias);
    assert.equal(fs.realpathSync.native(alias), fs.realpathSync.native(other));
    assert.throws(() => pluginCacheDirectory(second, ownership), { cause: reason });
    process.env.TTSC_TEST_CACHE_DIR = other;
    assert.equal(pluginCacheDirectory(second, ownership), other);
    fs.unlinkSync(alias);
    fs.rmSync(cache, { recursive: true });
    fs.mkdirSync(cache);
    fs.writeFileSync(path.join(cache, "sentinel"), "replacement bytes");
    process.env.TTSC_TEST_CACHE_DIR = cache;
    assert.throws(() => pluginCacheDirectory(second, ownership), { cause: reason });
    assert.equal(fs.readFileSync(path.join(cache, "sentinel"), "utf8"), "replacement bytes");
    assert.deepEqual(delegated, [reason.message]);
  } finally {
    if (previous === undefined) delete process.env.TTSC_TEST_CACHE_DIR;
    else process.env.TTSC_TEST_CACHE_DIR = previous;
    fs.rmSync(root, { recursive: true, force: true });
  }
}
