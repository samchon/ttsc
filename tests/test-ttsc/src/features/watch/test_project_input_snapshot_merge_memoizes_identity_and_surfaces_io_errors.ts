import assert from "node:assert/strict";
import path from "node:path";

import { mergeProjectInputSnapshots } from "../../../../../packages/ttsc/lib/compiler/internal/runBuild.js";
import { createProjectInputPathIdentityContext } from "../../../../../packages/ttsc/lib/internal/projectInputPathIdentity.js";

/**
 * Verifies one snapshot merge memoizes ancestor probes and preserves hard
 * filesystem failures instead of reclassifying them as missing declarations.
 *
 * Project rules may publish many absent paths below one directory. Probing
 * every ancestor for every declaration is avoidable, while swallowing access or
 * I/O failures would silently watch a different identity than requested.
 *
 * 1. Resolve one hundred missing siblings through one shared ancestor cache.
 * 2. Assert case-semantics discovery is also cached for the physical ancestor.
 * 3. Assert EACCES, EIO, and ELOOP escape immediately without parent ascent.
 */
export const test_project_input_snapshot_merge_memoizes_identity_and_surfaces_io_errors =
  (): void => {
    const root = path.resolve("virtual-project-input-root");
    const files = Array.from({ length: 100 }, (_, index) =>
      path.join(root, "shared", "nested", `input-${index}.md`),
    );
    let realpathCalls = 0;
    let caseSensitivityCalls = 0;
    const identities = createProjectInputPathIdentityContext({
      caseSensitive: () => {
        caseSensitivityCalls++;
        return true;
      },
      realpath: (location) => {
        realpathCalls++;
        if (location === root) return root;
        throw filesystemError("ENOENT");
      },
    });

    const merged = mergeProjectInputSnapshots(
      root,
      [{ root, files, globs: [] }],
      identities,
    );
    assert.equal(merged.files.length, files.length);
    assert.equal(
      realpathCalls,
      103,
      "the root, two shared missing ancestors, and each leaf need one probe",
    );
    assert.equal(
      caseSensitivityCalls,
      1,
      "one physical ancestor needs one case-semantics query per merge",
    );

    for (const code of ["EACCES", "EIO", "ELOOP"] as const) {
      const target = path.join(root, `blocked-${code}.md`);
      const calls: string[] = [];
      const failure = filesystemError(code);
      const failingIdentities = createProjectInputPathIdentityContext({
        caseSensitive: () => true,
        realpath: (location) => {
          calls.push(location);
          if (location === root) return root;
          if (location === target) throw failure;
          throw new Error(`unexpected parent probe after ${code}: ${location}`);
        },
      });

      assert.throws(
        () =>
          mergeProjectInputSnapshots(
            root,
            [{ root, files: [target], globs: [] }],
            failingIdentities,
          ),
        (error) => error === failure,
        `${code} must remain observable to the project-input producer`,
      );
      assert.deepEqual(
        calls,
        [root, target],
        `${code} must not trigger nearest-existing-ancestor fallback`,
      );
    }
  };

function filesystemError(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(code), { code });
}
