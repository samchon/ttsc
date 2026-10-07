import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Allocate a native fixture and measure its case-distinct entry capability.
 *
 * Windows exposes a per-directory preparation tool; other hosts use the
 * existing filesystem. Preparation changes only the newly allocated child,
 * never the supplied parent. An exclusive two-directory probe observes the
 * actual capability, repeated after Windows preparation. An EEXIST refusal
 * must preserve the first entry, its bytes and its identity before callers select a representable recovery row.
 * False records an unavailable case-only subexperiment, not a passed test.
 *
 * @evidence contracts/common.md#principled-implementation Exclusive mkdir distinguishes two native entries from an existing alias; independent realpath/stat, listing and marker observations verify the collision leaves the original unchanged.
 * @evidence contracts/common.md#clear-and-simple-design One fixture preparation operation owns the existing Windows tool boundary and common native probe for both topology consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Only EEXIST selects unavailable capability after identity and no-mutation checks; permission, tool, space and other failures propagate. The helper does not skip its consumer.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish preparation, actual capability measurement and the caller-owned recovery row from successful case-only coverage.
 * @evidence contracts/portability.md#os-neutral-implementation Actual exclusive directory creation measures the supplied filesystem rather than inferring case policy from platform. Only the documented Windows preparation executable is platform-selected.
 * @evidence contracts/performance.md#efficient-algorithms A constant-size isolated probe creates two entries and a marker and scans their fixed directory population; native path resolution and tool execution contribute host-dependent cost.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each parent owns an independent capability observation after preparation; cached host-wide policy would not represent per-directory or per-volume behavior.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The allocated child transfers to the caller on success and is removed on failure; its tracked parent owns later cleanup. A synchronous tool has a 30-second timeout and hidden window. Each exclusive probe is removed in finally; cleanup failures propagate.
 */
export function prepareCaseSensitiveFixture(parent: string): {
  directory: string;
  caseDistinct: boolean;
} {
  const directory = fs.mkdtempSync(path.join(parent, "native-case-fixture-"));
  try {
    const before = probeCaseDistinctEntries(directory);
    if (process.platform === "win32") {
      const result = childProcess.spawnSync(
        "fsutil.exe",
        ["file", "setCaseSensitiveInfo", directory, "enable"],
        { encoding: "utf8", windowsHide: true, timeout: 30_000 },
      );
      assert.equal(
        result.status,
        0,
        `native case-sensitive fixture preparation failed: ${result.error?.message ?? result.stderr}`,
      );
    }
    const caseDistinct = process.platform === "win32"
      ? probeCaseDistinctEntries(directory)
      : before;
    if (process.platform === "win32") assert.equal(caseDistinct, true);
    if (!caseDistinct)
      console.log("case-distinct capability unavailable; collision preserved native identity and bytes");
    return { directory, caseDistinct };
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

/** Observe exclusive native entries without changing the parent's case policy. */
function probeCaseDistinctEntries(directory: string): boolean {
  const probe = fs.mkdtempSync(path.join(directory, "case-capability-"));
  const upper = path.join(probe, "Entry");
  const lower = path.join(probe, "entry");
  try {
    fs.mkdirSync(upper);
    const marker = path.join(upper, "marker");
    fs.writeFileSync(marker, "unchanged native entry\n", { flag: "wx" });
    const before = fs.statSync(upper);
    try {
      fs.mkdirSync(lower);
    } catch (error) {
      assert.ok(error instanceof Error && "code" in error);
      assert.equal(error.code, "EEXIST");
      assert.equal(fs.realpathSync.native(lower), fs.realpathSync.native(upper));
      const after = fs.statSync(lower);
      assert.deepEqual([after.dev, after.ino], [before.dev, before.ino]);
      assert.deepEqual(fs.readdirSync(probe), ["Entry"]);
      assert.deepEqual(fs.readdirSync(lower), ["marker"]);
      assert.equal(fs.readFileSync(marker, "utf8"), "unchanged native entry\n");
      return false;
    }
    assert.notEqual(fs.realpathSync.native(upper), fs.realpathSync.native(lower));
    assert.deepEqual(fs.readdirSync(lower), []);
    assert.equal(fs.readFileSync(marker, "utf8"), "unchanged native entry\n");
    return true;
  } finally {
    fs.rmSync(probe, { recursive: true, force: true });
  }
}
