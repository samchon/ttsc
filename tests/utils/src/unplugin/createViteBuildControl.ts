import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { TestProject } from "../TestProject";

/**
 * Own one Vite actor's ignored request, restoration journal and final result.
 *
 * The caller supplies the original native retirement classification and the
 * result of every input restoration. Only known retirement plus complete
 * restoration permits release. Unresolved storage remains outside automatic
 * process-exit cleanup so the original actor cannot lose its inputs on exit.
 * Native identity refusal and removal failures propagate to the caller, which
 * must collect them alongside execution and restoration failures.
 *
 * @evidence contracts/common.md#principled-implementation Exclusive directory creation establishes one allocation; native physical path and directory identity must still match before recursive removal. Original retirement and completed restoration are separate caller-owned prerequisites.
 * @evidence contracts/common.md#clear-and-simple-design One Vite-specific allocation returns its path and release operation; it introduces no registry, process owner or restoration framework.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The existing native owner supplies retirement rather than elapsed time, public watcher closure or process absence. Unknown lifetime, incomplete restoration and replaced directory identity refuse deletion.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies receipt readers, caller prerequisites, explicit uncertainty retention and independent error collection; returned members describe their ownership.
 * @evidence contracts/portability.md#os-neutral-implementation Node native paths, realpath and lstat compare physical directory identity without inferring filesystem case policy from the OS. Git checks ignore status before directory creation.
 * @evidence contracts/performance.md#efficient-algorithms Allocation performs a fixed number of ignore and native metadata checks; release visits only this leaf's stored entries and bytes, with no parent or sibling traversal.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each original actor needs its own mutable request and transition journal; this operation neither shares computation nor reuses an earlier allocation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller releases each leaf immediately after known original retirement and all restoration readers finish. Unknown lifetime, incomplete restoration or failed identity/removal leaves storage explicitly caller-owned with no automatic exit deletion; unresolved allocations have no claimed bound.
 */
export function createViteBuildControl(parent: string): {
  /** Exact exclusive allocation; sibling leaves and the parent remain foreign. */
  readonly root: string;

  /** Remove only the original allocation after both caller prerequisites hold. */
  release(
    lifetime: "joined" | "not-started" | "unknown",
    restored: boolean,
  ): void;
} {
  assert.ok(path.isAbsolute(parent), "Vite control parent must be absolute");
  const root = path.join(parent, "vite-build-control-" + randomUUID());
  for (const file of [
    parent,
    root,
    path.join(root, "request.json"),
    path.join(root, "record-transition.json"),
    path.join(root, "result.json"),
  ])
    execFileSync("git", ["check-ignore", "--quiet", "--", file], {
      cwd: TestProject.WORKSPACE_ROOT,
    });
  fs.mkdirSync(parent, { recursive: true });
  fs.mkdirSync(root);
  const original = fs.lstatSync(root);
  const identity = {
    physical: fs.realpathSync.native(root),
    dev: original.dev,
    ino: original.ino,
    birthtimeMs: original.birthtimeMs,
  };
  return {
    root,
    release(lifetime, restored) {
      if (lifetime === "unknown" || !restored)
        throw new Error(
          "Vite control retained pending original retirement and restoration: " +
            root,
        );
      const current = fs.lstatSync(root);
      assert.equal(
        current.isDirectory() && !current.isSymbolicLink(),
        true,
        "Vite control is no longer the owned directory: " + root,
      );
      assert.deepEqual(
        {
          physical: fs.realpathSync.native(root),
          dev: current.dev,
          ino: current.ino,
          birthtimeMs: current.birthtimeMs,
        },
        identity,
        "Vite control identity changed; refusing removal: " + root,
      );
      fs.rmSync(root, { recursive: true });
    },
  };
}
