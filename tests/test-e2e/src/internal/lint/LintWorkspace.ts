import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/** Owns the lint experiment's consumer tree; sibling cases share its lifetime. */
export namespace LintWorkspace {
  let current: string | undefined;

  /**
   * Allocate the package's one consumer root before preparing its connections.
   *
   * @evidence contracts/common.md#principled-implementation A tracked real temporary directory owns consumer inputs. Cases receive sibling paths and cannot inherit another case's manifest or lint configuration through ancestor lookup.
   * @evidence contracts/common.md#clear-and-simple-design One root and explicit open/close lifetime replace independently allocated ordinary consumer roots.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No product object or result is substituted. Opening an already active experiment fails instead of discarding its owner.
   * @evidence contracts/common.md#meaningful-documentation States the ancestor-isolation reason for sibling consumer paths.
   * @evidence contracts/portability.md#os-neutral-implementation The existing tracked temporary-directory owner resolves the physical OS temporary root; Node path operations join its cases.
   * @evidence contracts/performance.md#efficient-algorithms Allocates one directory and retains one path.
   * @evidence contracts/performance.md#reuse-equivalent-work The package lifetime and parent tree serve all ordinary consumers, while their conflicting configurations remain siblings.
   * @evidence contracts/performance.md#bound-retention-and-release-resources close removes and verifies the whole owned tree after the synchronous launcher and evaluator calls have joined.
   */
  export function open(): void {
    assert.equal(current, undefined, "Lint experiment already owns a workspace");
    current = TestProject.tmpdir("ttsc-lint-e2e-");
  }

  /**
   * Return a confined sibling input directory within the active experiment.
   *
   * @evidence contracts/common.md#principled-implementation The name is one validated path segment and the active root was allocated by this owner; sibling contexts preserve distinct discovery ancestors.
   * @evidence contracts/common.md#clear-and-simple-design An optional mkdir serves cases that previously received an already allocated empty directory.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing ownership and path-like names fail before filesystem changes.
   * @evidence contracts/common.md#meaningful-documentation States the create option's purpose and confinement rule.
   * @evidence contracts/portability.md#os-neutral-implementation Node joins the validated segment and creates directories without shell interpretation.
   * @evidence contracts/performance.md#efficient-algorithms Path validation and joining scale with the short case name; no source traversal occurs.
   * @evidence contracts/performance.md#reuse-equivalent-work All names use the same package parent and consumer root lifetime.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Returned paths belong to the parent owner and close removes even an abandoned empty directory.
   */
  export function caseRoot(name: string, create = false): string {
    assert.ok(current, "Lint experiment has no workspace owner");
    assert.match(name, /^[a-zA-Z0-9_-]+$/, "Lint consumer names are path segments");
    const root = path.join(current, name);
    if (create) fs.mkdirSync(root, { recursive: true });
    return root;
  }

  /**
   * Release the package tree and verify the actual postcondition.
   *
   * @evidence contracts/common.md#principled-implementation Actual recursive removal plus an absence assertion verifies release of all ordinary consumer inputs, including a case that failed during preparation.
   * @evidence contracts/common.md#clear-and-simple-design One removal releases the sole parent tree; each consumer may also release its own inputs earlier.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Cleanup errors propagate and the active owner is retained until removal succeeds.
   * @evidence contracts/common.md#meaningful-documentation States the observed postcondition rather than relying only on an exit hook.
   * @evidence contracts/portability.md#os-neutral-implementation Node recursive removal retries transient Windows filesystem failures and uses the exact allocated root.
   * @evidence contracts/performance.md#efficient-algorithms Cleanup visits the remaining owned files once.
   * @evidence contracts/performance.md#reuse-equivalent-work One cleanup covers every consumer and preparation failure under the shared parent.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The absence assertion precedes clearing the retained root identity.
   */
  export function close(): void {
    assert.ok(current, "Lint experiment has no workspace owner");
    fs.rmSync(current, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    assert.equal(fs.existsSync(current), false, "Lint consumer workspace remained after cleanup");
    current = undefined;
  }
}
