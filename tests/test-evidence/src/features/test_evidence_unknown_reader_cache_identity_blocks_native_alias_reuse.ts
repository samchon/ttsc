import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EvidenceProcessOwnership } from "../internal/EvidenceProcessOwnership";
import { linkDirectory } from "../internal/linkDirectory";
import { pluginCacheDirectory } from "../internal/pluginCacheDirectory";

/**
 * Verifies cache admission follows actual native aliases and retargeted identities.
 *
 * Lexical path equality cannot establish which physical cache a directory link
 * selects. This case owns that real filesystem boundary without preparing a
 * compiler or supplying a synthetic SDK or native protocol response.
 *
 * 1. Link one actual cache and register its native identity for a fixture.
 * 2. Retain the authored unknown-reader state and refuse another fixture's alias.
 * 3. Retarget the used link, refuse that spelling and admit the distinct target directly.
 * 4. Replace the original cache at its old path and require sticky refusal.
 *
 * @evidence contracts/testing.md#behavioral-verification Uses a real native directory link, realpath and directory replacement with the actual cache/ownership operations. The used alias remains refused after unknown-reader input and retargeting, the distinct target is admitted through its independent spelling, and the replaced original path remains refused.
 * @evidence contracts/testing.md#independent-expectations Authored target paths and actual realpath observations establish which directory the kernel selected independently of registry keys; unchanged sentinel bytes distinguish admission from accidental deletion.
 * @evidence contracts/testing.md#distinguishing-cases Same physical target through another spelling is refused; a used alias stays blocked after retargeting while the distinct target's independent spelling is admitted. Replacement at the original physical path cannot clear sticky unknown state. There is no Windows permission skip.
 * @evidence contracts/testing.md#execution-ownership The matching src/features export is discovered by the suite's ordinary E2E runner and central function claim. It executes actual native filesystem identity/link operations in that Node process; no CLI, Go binary, installer or additional product host is created.
 * @evidence contracts/e2e.md#necessary-boundary Node's actual directory-link and realpath/stat boundary must connect to shared-cache admission; a pure resolver or manufactured metadata cannot prove native alias and retarget behavior.
 * @evidence contracts/e2e.md#shared-execution One private root and one explicit actual ownership operation serve alias, retarget and replacement states in the existing E2E process. This adds no consumer install, compiler preparation or native producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only this case's native targets and link are mutated; environment restoration and exact owned-root removal run in finally. The explicit retention callback records a reason and touches no shared default owner. The authored unknown state has no actual process reader, so cleanup removes only the caller's own inputs.
 * @evidence contracts/e2e.md#preserved-coverage The new alias/retarget/replacement oracle complements direct source admission/lexical-path units; every original compiler/watch status, PID/count, timeout and quiet assertion remains in its existing owner.
 */
export function test_evidence_unknown_reader_cache_identity_blocks_native_alias_reuse(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "evidence-native-cache-identity-"));
  const previous = process.env.TTSC_TEST_CACHE_DIR;
  const cache = path.join(root, "cache");
  const other = path.join(root, "other");
  const alias = path.join(root, "alias");
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
