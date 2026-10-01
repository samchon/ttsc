import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { denyWrites, runsAsRoot } from "../../../internal/ttsc/internal/read-only-directory";

/**
 * Verifies ttsx names the directory and the remedy when a project directory
 * refuses the temporary tsconfig an out-of-`include` entry needs.
 *
 * TypeScript-Go's command line cannot combine a project with a file list, so an
 * entry outside the project's file set is compiled through a tsconfig that
 * extends the project's and is written beside it for the length of the build;
 * only there do `${configDir}`, the default `typeRoots`, and `types` resolve as
 * they do for the project. A read-only checkout, mount, or volume refuses that
 * write. The run used to end on a bare `EPERM` naming a file the user never
 * created; it now says which directory and what to change, and an entry the
 * project includes still runs from the same directory.
 *
 * Root ignores directory permissions, so the case cannot hold there.
 *
 * 1. Create a project that includes `src` and an entry beside the tsconfig.
 * 2. Deny writes to the project directory, keeping the runtime cache elsewhere.
 * 3. Assert the out-of-include entry fails naming the directory and the remedy,
 *    and the included entry runs.
 * @evidence contracts/testing.md#behavioral-verification With project writes denied and cache elsewhere, excluded clear.ts must fail status 2 naming the directory/remedy without running; included src/main.ts must still print included-ran.
 * @evidence contracts/testing.md#independent-expectations Actual directory permissions and authored include membership independently separate denied temporary-config creation from a runnable included project; exact status/remedy text narrow the failure.
 * @evidence contracts/testing.md#distinguishing-cases Excluded and included entries use the same denied directory. Root returns before all assertions; POSIX modes and Windows deny ACL implement different real permission boundaries.
 * @evidence contracts/testing.md#execution-ownership The named test_ttsx_names_an_unwritable_project_directory_for_an_out_of_include_entry E2E entry owns the actual bootstrap and observations specified here. TestProject/internal helpers supply fixtures and completed process results; this acknowledgment does not infer portable unit coverage from similarly named tests.
 * @evidence contracts/e2e.md#necessary-boundary Native fallback config creation must respect actual filesystem permissions and the launcher must report actionable context. Direct policy checks cannot prove an OS denial is classified correctly.
 * @evidence contracts/e2e.md#shared-execution One fixture, one external cache and two host lifetimes isolate failure/success under the same permissions. Windows deny/restore add native ACL processes; no compiler install repeats.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Finally restores permissions before tracked cleanup. POSIX restore reuses original mode; Windows restore command status is not checked, so guaranteed ACL restoration is not claimed. Root execution skips the case.
 * @evidence contracts/e2e.md#preserved-coverage Original status, path, include/files remedy, no outside output and included success/value remain. Permission enforcement and restoration limitations are explicit.
 */
export function test_ttsx_names_an_unwritable_project_directory_for_an_out_of_include_entry() {
    if (runsAsRoot()) return;
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_names_an_unwritable_project_directory_for_an_out_of_include_entry/inputs-1"));
    const cacheDir = TestProject.tmpdir("ttsx-readonly-cache-");
    const restore = denyWrites(root);
    try {
      const outside = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, "--cache-dir", cacheDir, "clear.ts"],
        { cwd: root },
      );
      assert.equal(outside.status, 2, outside.stdout);
      assert.match(outside.stderr, /is not writable/);
      assert.ok(
        outside.stderr.includes(fs.realpathSync.native(root)) ||
          outside.stderr.includes(root),
        outside.stderr,
      );
      assert.match(outside.stderr, /"include" or "files"/);
      assert.doesNotMatch(outside.stdout, /outside-ran/);

      const included = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, "--cache-dir", cacheDir, "src/main.ts"],
        { cwd: root },
      );
      assert.equal(included.status, 0, included.stderr);
      assert.equal(included.stdout.trim(), "included-ran");
    } finally {
      restore();
    }
  }
