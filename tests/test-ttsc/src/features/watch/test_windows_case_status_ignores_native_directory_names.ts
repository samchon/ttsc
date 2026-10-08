import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createProjectInputPathIdentityContext } from "../../../../../packages/ttsc/src/internal/pathIdentity/createProjectInputPathIdentityContext";
import { planCompilerDirectoryWatchEvent } from "../../../../../packages/ttsc/src/launcher/internal/watch/planCompilerDirectoryWatchEvent";

/**
 * Verifies real Windows case queries ignore status words in directory names.
 *
 * Empty-directory discovery must agree with independently observed native
 * filename aliases. Witness files are created only after the empty-directory
 * query and missing-suffix observations, so entry evidence cannot bypass the
 * fsutil fallback being checked. No case flag is changed.
 *
 * 1. Query five fresh empty directories with ordinary or status-word names.
 * 2. Observe real filename aliases and compare the earlier identity decisions.
 * 3. Select compiler-watch candidates and preserve existing physical identity.
 * 4. Collect all directory outcomes before removing the owned temporary root.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the default project-input identity context against actual empty Windows directories, checks its caseSensitive answer and unresolved suffix keys, then calls the actual directory-event planner with a real existing tracked file and its case variant. Fresh-context physical resolution must agree with native realpath aliases.
 * @evidence contracts/testing.md#independent-expectations After each empty-directory query, a newly created Tracked.ts and the independent native existence/realpath observation of tracked.ts establish sensitive versus insensitive lookup. The original still exists when an alternate is absent. Those observations, not the context's answer or OS name, determine expected case authority, suffix equality and candidate arrays.
 * @evidence contracts/testing.md#distinguishing-cases Ordinary, enabled, disabled, EnAbLeD and DiSaBlEd directories exercise actual localized or English native responses without modifying flags. The same context must apply established policy to missing children and event candidates, while a fresh context preserves existing physical aliases. Genuine native sensitivity is asserted only if the witness lookup independently establishes it; portable parser and injected-authority cases separately own unknown routing. Non-Windows hosts explicitly skip this Windows-native boundary.
 * @evidence contracts/testing.md#execution-ownership This named direct source unit uses native temporary directories and the resolver's read-only fsutil query, with synchronous native child completion and no compiler, installation, Go build or watcher. Each directory's errors are retained, all five cases complete before cleanup, and the exact physical temporary parent and owned prefix are checked before recursive removal. Candidate planning does not certify actual watch notification delivery.
 */
export function test_windows_case_status_ignores_native_directory_names():
  | void
  | false {
  if (process.platform !== "win32") return false;
  const temporary = fs.realpathSync.native(os.tmpdir());
  const root = fs.mkdtempSync(path.join(temporary, "ttsc-case-status-"));
  const failures: Error[] = [];
  try {
    const names = ["ordinary", "enabled", "disabled", "EnAbLeD", "DiSaBlEd"];
    for (const [index, name] of names.entries()) {
      try {
        // Separate parents keep mixed-case names distinct on insensitive roots.
        const parent = path.join(root, String(index));
        fs.mkdirSync(parent);
        const directory = path.join(parent, name);
        fs.mkdirSync(directory);
        assert.deepEqual(fs.readdirSync(directory), []);
        const identities = createProjectInputPathIdentityContext();
        const observed = identities.caseSensitive(directory);
        const upper = path.join(directory, "Future.ts");
        const lower = path.join(directory, "future.ts");
        const sameMissingIdentity =
          identities.resolve(upper).key === identities.resolve(lower).key;
        const sameLexicalKey =
          identities.lexicalKey(upper) === identities.lexicalKey(lower);
        const aliasCandidate = identities.lexicalMatches(upper, lower);
        const withinCandidate = identities.lexicalIsWithin(
          path.join(directory, "Future"),
          path.join(directory, "future", "child.ts"),
        );

        const witness = path.join(directory, "Tracked.ts");
        const alternate = path.join(directory, "tracked.ts");
        fs.writeFileSync(witness, "native identity witness\n", { flag: "wx" });
        const physical = fs.realpathSync.native(witness);
        const aliasExists = fs.existsSync(alternate);
        const sensitive =
          aliasExists === false || fs.realpathSync.native(alternate) !== physical;
        const plan = planCompilerDirectoryWatchEvent({
          changed: alternate,
          event: "change",
          exists: fs.existsSync,
          identities,
          location: directory,
          platform: process.platform,
          trackedFiles: new Map([[identities.lexicalKey(witness), witness]]),
        });
        const existing = createProjectInputPathIdentityContext();
        const existingWitness = existing.resolve(witness);
        const existingAlias = aliasExists
          ? existing.resolve(alternate).key
          : undefined;
        const entryAuthority = existing.caseSensitive(directory);
        assert.equal(fs.existsSync(witness), true);
        console.log(
          "native Windows case status",
          JSON.stringify({
            name,
            observed: observed ?? "unavailable",
            sensitive,
            aliasExists,
            sameMissingIdentity,
            sameLexicalKey,
            aliasCandidate,
            withinCandidate,
            plan,
          }),
        );
        assert.equal(
          observed,
          sensitive,
          "empty-directory capability must agree with native filename lookup",
        );
        assert.equal(sameMissingIdentity, sensitive === false);
        assert.equal(sameLexicalKey, sensitive === false);
        assert.equal(aliasCandidate, sensitive === false);
        assert.equal(withinCandidate, sensitive === false);
        assert.deepEqual(plan, {
          changes: sensitive ? [] : [witness],
          rearm: [],
          refresh: sensitive,
        });
        assert.equal(existingWitness.path, physical);
        if (sensitive === false)
          assert.equal(existingWitness.key, existingAlias);
        assert.equal(entryAuthority, sensitive);
      } catch (cause) {
        failures.push(new Error(`native case status: ${name}`, { cause }));
      }
    }
  } finally {
    try {
      assert.equal(path.dirname(root), temporary);
      assert.equal(path.basename(root).startsWith("ttsc-case-status-"), true);
      fs.rmSync(root, { recursive: true, force: true });
    } catch (cause) {
      failures.push(new Error("native case-status fixture cleanup", { cause }));
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "native Windows case-status observations");
}
