import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { realpathHostInput } from "../../../../../packages/ttsc/src/plugin/internal/load/realpathHostInput";
import { realpathHostInputPaths } from "../../../../../packages/ttsc/src/plugin/internal/load/realpathHostInputPaths";

/**
 * Verifies absent host-input candidates yield null without invoking realpath,
 * while present entries, links, and later-created candidates resolve to their
 * physical paths.
 *
 * Module-resolution candidate lists contain mostly absent extension
 * permutations whose absence is already established by one `lstat` returning
 * ENOENT or ENOTDIR; calling `fs.realpathSync.native` on every absent candidate
 * wasted seconds of pre-host setup.
 *
 * 1. Observe an absent candidate and a path under a regular file (ENOTDIR) through
 *    `realpathHostInput` and `realpathHostInputPaths` with a counting realpath
 *    callback; assert both yield `null` with zero realpath calls.
 * 2. Observe a present file, a symlink to it, and a broken symlink; assert the
 *    file and link return the physical path and the broken link returns
 *    `null`.
 * 3. Create the previously absent candidate and re-observe in a fresh phase;
 *    assert it now yields its physical path so recorded-versus-current realpath
 *    comparison detects the change.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises realpathHostInput and realpathHostInputPaths over real files, symlinks, absent paths and regular-file descendants using the counting realpath seam, checking returned physical identities and exact realpath call counts.
 * @evidence contracts/testing.md#independent-expectations Real filesystem targets from fs.realpathSync.native on created files, null for absent or broken targets, and zero realpath invocations on ENOENT/ENOTDIR paths define expectations independently of implementation internals.
 * @evidence contracts/testing.md#distinguishing-cases Contrasts absent ENOENT candidates and ENOTDIR paths under a regular file (zero realpath calls) with present files, symlinks, broken symlinks and a candidate created between two phases; within-phase map deduplication stays in test_host_input_observations_deduplicate_within_phase.
 * @evidence contracts/testing.md#execution-ownership Discovered unit calls the maintained source helpers directly over an owned temporary directory removed in finally; no compiler, Go process or host runs.
 */
export function test_host_input_realpath_skips_absent_candidates(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-realpath-absent-")),
  );
  try {
    const present = path.join(root, "present.ts");
    const link = path.join(root, "link.ts");
    const brokenLink = path.join(root, "broken.ts");
    const absent = path.join(root, "missing.ts");
    const underFile = path.join(present, "nested.ts");
    fs.writeFileSync(present, "export const x = 1;\n");
    fs.symlinkSync(present, link, "file");
    fs.symlinkSync(path.join(root, "dangling-target.ts"), brokenLink, "file");

    const failures: unknown[] = [];
    const verify = (name: string, run: () => void): void => {
      try {
        run();
      } catch (cause) {
        failures.push(new Error(name, { cause }));
      }
    };

    verify("absent candidate yields null with no realpath call", () => {
      const realpathCalls: string[] = [];
      const countingRealpath = (file: string): string => {
        realpathCalls.push(file);
        return fs.realpathSync.native(file);
      };
      const result = realpathHostInputPaths([absent], undefined, (file) =>
        realpathHostInput(file, countingRealpath),
      );
      assert.equal(result[absent], null);
      assert.equal(
        realpathCalls.length,
        0,
        `expected 0 realpath calls for absent candidate, got ${realpathCalls.length}: ${JSON.stringify(realpathCalls)}`,
      );
    });

    verify(
      "present file and symlink yield physical paths and broken link yields null",
      () => {
        const realpathCalls: string[] = [];
        const countingRealpath = (file: string): string => {
          realpathCalls.push(file);
          return fs.realpathSync.native(file);
        };
        const result = realpathHostInputPaths(
          [present, link, brokenLink],
          undefined,
          (file) => realpathHostInput(file, countingRealpath),
        );
        assert.equal(result[present], present);
        assert.equal(result[link], present);
        assert.equal(result[brokenLink], null);
        assert.equal(
          realpathCalls.length,
          3,
          `expected 3 realpath calls for present file, link, and broken link, got ${realpathCalls.length}`,
        );
      },
    );

    verify(
      "path under a regular file (ENOTDIR) yields null with no realpath call",
      () => {
        const realpathCalls: string[] = [];
        const countingRealpath = (file: string): string => {
          realpathCalls.push(file);
          return fs.realpathSync.native(file);
        };
        const result = realpathHostInputPaths([underFile], undefined, (file) =>
          realpathHostInput(file, countingRealpath),
        );
        assert.equal(result[underFile], null);
        assert.equal(
          realpathCalls.length,
          0,
          `expected 0 realpath calls for ENOTDIR candidate, got ${realpathCalls.length}: ${JSON.stringify(realpathCalls)}`,
        );
      },
    );

    verify(
      "absent candidate created later yields its physical path in a fresh phase",
      () => {
        const before = realpathHostInputPaths([absent]);
        assert.equal(before[absent], null);

        fs.writeFileSync(absent, "export const appeared = true;\n");
        const after = realpathHostInputPaths([absent]);
        assert.equal(after[absent], fs.realpathSync.native(absent));
        assert.notEqual(
          after[absent],
          before[absent],
          "creating an absent candidate must change its observed physical path",
        );
      },
    );

    if (failures.length !== 0)
      throw new AggregateError(
        failures,
        "absent host-input realpath checks failed",
      );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
