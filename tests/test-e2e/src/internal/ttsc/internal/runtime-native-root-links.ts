import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Pins one completed canonical host's explicit runtime index to a sibling
 * physical directory. The caller owns root, has joined earlier hosts, and has
 * not begun using this explicit cache. No new project or launcher is created.
 * This setup does not itself prove runtime start, child admission or cleanup.
 *
 * @evidence contracts/common.md#principled-implementation A fresh owned physical directory and a native link establish a different generation parent before the real canonical host claims any run; independently empty initial contents prevent an old generation from supplying the later cleanup observation.
 * @evidence contracts/common.md#clear-and-simple-design Preparation returns only the physical directory needed by the parent after its configured host closes; the parent keeps launcher status and user-output assertions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native filesystem calls create the actual alias without replacing runtime lock, claim, compiler or loader operations. An absent link capability fails this case rather than predicting successful transport.
 * @evidence contracts/common.md#meaningful-documentation States caller root ownership, joined earlier readers, unused explicit cache and the setup's lack of runtime completion evidence.
 * @evidence contracts/portability.md#os-neutral-implementation Node creates a Windows junction or POSIX directory link; lstat and native realpath verify the actual representation and target instead of inferring identity from the OS name.
 * @evidence contracts/performance.md#efficient-algorithms Constant-count directory and identity operations prepare one existing canonical cache; no fixture traversal, compiler preparation or launcher starts here.
 * @evidence contracts/performance.md#reuse-equivalent-work The existing configured host consumes this one prepared index. Repeated preparation is refused because its cache admission state would no longer be equivalent.
 * @evidence contracts/performance.md#bound-retention-and-release-resources No handles or processes remain in this setup; the parent's tracked canonical root owns the physical directory and alias through host completion, failure and test-process cleanup.
 */
export function prepareCanonicalLinkedRuntimeIndex(root: string): string {
  const cache = path.join(root, ".ttsx-cache");
  const physicalRuns = path.join(root, "physical-runs");
  const link = path.join(cache, "project");
  assert.equal(
    fs.existsSync(link),
    false,
    "linked index must precede first cache admission",
  );
  assert.equal(
    fs.existsSync(physicalRuns),
    false,
    "physical run index must be an owned fresh name",
  );
  fs.mkdirSync(cache, { recursive: true });
  fs.mkdirSync(physicalRuns);
  fs.symlinkSync(
    physicalRuns,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
  assert.equal(
    fs.realpathSync.native(link),
    fs.realpathSync.native(physicalRuns),
  );
  assert.deepEqual(fs.readdirSync(physicalRuns), []);
  return physicalRuns;
}

/**
 * Observes physical generation removal after the actual configured dirname
 * launcher and its program have closed. Its same-host status and literal
 * linked-run marker are asserted by the canonical parent entry. Empty index
 * state before a host executes never supplies this cleanup evidence.
 *
 * @evidence contracts/common.md#principled-implementation Reading the physical index after actual host closure detects a retained generation even when the lexical cache only contains an alias.
 * @evidence contracts/common.md#clear-and-simple-design This observer owns only the empty physical index assertion; the parent owns actual host completion, zero status and literal linked-run execution.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts It reads the actual physical directory and never deletes a generation to manufacture an empty result.
 * @evidence contracts/common.md#meaningful-documentation Explains that caller-observed host closure is required and initial emptiness is not cleanup evidence.
 * @evidence contracts/portability.md#os-neutral-implementation Native directory enumeration preserves filesystem semantics without case folding or lexical alias guesses.
 * @evidence contracts/performance.md#efficient-algorithms One O(E) directory enumeration observes the current run population without recursive scanning.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Exit cleanup must be freshly observed for this host; a prior empty index cannot answer for another run.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The synchronous observer opens no retained handle and transfers no resource; directory and process ownership remain with the parent.
 */
export function verifyCanonicalLinkedRuntimeIndexClosed(
  physicalRuns: string,
): void {
  assert.deepEqual(fs.readdirSync(physicalRuns), []);
}
