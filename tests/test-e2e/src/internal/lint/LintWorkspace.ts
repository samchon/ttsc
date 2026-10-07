import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/** Owns the lint experiment's consumer tree; sibling cases share its lifetime. */
export namespace LintWorkspace {
  let current: string | undefined;
  let borrowed = false;
  let producer: "workspace" | "snapshot" = "workspace";

  /**
   * Allocate the package's one consumer root before preparing its connections.
   *
   * @evidence contracts/common.md#principled-implementation A standalone tracked root or a fresh child of the caller's absolute common owner holds consumer inputs. Cases receive sibling paths and cannot inherit another case's manifest or lint configuration through ancestor lookup. Borrowing selects the caller's explicit immutable or live producer; native package identity remains observed by its preparation owner.
   * @evidence contracts/common.md#clear-and-simple-design One root and explicit open/close lifetime replace independently allocated ordinary consumer roots.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No product object or result is substituted. Opening an already active experiment fails instead of discarding its owner.
   * @evidence contracts/common.md#meaningful-documentation States the ancestor-isolation reason for sibling consumer paths.
   * @evidence contracts/portability.md#os-neutral-implementation The existing tracked temporary-directory owner resolves the physical OS temporary root; Node path operations join its cases.
   * @evidence contracts/performance.md#efficient-algorithms Allocates one directory and retains one path.
   * @evidence contracts/performance.md#reuse-equivalent-work The package lifetime and parent tree serve all ordinary consumers, while their conflicting configurations remain siblings.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Standalone close removes and verifies its owned tree; borrowed close clears this active input context and leaves directory retention/removal to the caller. Neither operation proves arbitrary descendant retirement.
   */
  export function open(preparation?: {
    root: string;
    nativeProducer: "workspace" | "snapshot";
  }): void {
    assert.equal(
      current,
      undefined,
      "Lint experiment already owns a workspace",
    );
    if (preparation) {
      assert.ok(
        path.isAbsolute(preparation.root),
        "Borrowed lint root must be absolute",
      );
      fs.mkdirSync(preparation.root);
      current = preparation.root;
      producer = preparation.nativeProducer;
      borrowed = true;
    } else {
      current = TestProject.tmpdir("ttsc-lint-e2e-");
      producer = "workspace";
      borrowed = false;
    }
  }

  /**
   * Selected immutable or live native producer for the active input population.
   *
   * @evidence contracts/common.md#principled-implementation Returns only the preparation owner's explicit selection; native package preparation and command results remain in their existing owners.
   * @evidence contracts/common.md#clear-and-simple-design One selector connects compatible lint projects to the same snapshot identity already prepared by the common consumer.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not override an explicitly supplied project selector or infer source identity from a version or result.
   * @evidence contracts/common.md#meaningful-documentation The selector is an active workspace input, not proof that the producer ran or that a cache hit occurred.
   */
  export function nativeProducer(): "workspace" | "snapshot" {
    assert.ok(current, "Lint experiment has no workspace owner");
    return producer;
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
    assert.match(
      name,
      /^[a-zA-Z0-9_-]+$/,
      "Lint consumer names are path segments",
    );
    const root = path.join(current, name);
    if (create) fs.mkdirSync(root, { recursive: true });
    return root;
  }

  /**
   * Release the package tree and verify the actual postcondition.
   *
   * @evidence contracts/common.md#principled-implementation Standalone recursive removal and absence verification release its inputs. A borrowed tree remains with its common owner; clearing this namespace's selector does not claim that tree was removed.
   * @evidence contracts/common.md#clear-and-simple-design One removal releases the sole parent tree; each consumer may also release its own inputs earlier.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Cleanup errors propagate and the active owner is retained until removal succeeds.
   * @evidence contracts/common.md#meaningful-documentation States the observed postcondition rather than relying only on an exit hook.
   * @evidence contracts/portability.md#os-neutral-implementation Node recursive removal retries transient Windows filesystem failures and uses the exact allocated root.
   * @evidence contracts/performance.md#efficient-algorithms Cleanup visits the remaining owned files once.
   * @evidence contracts/performance.md#reuse-equivalent-work One cleanup covers every consumer and preparation failure under the shared parent.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Standalone absence verification precedes clearing the active root. Borrowed directories remain caller-owned after the local context is released; failure retention and common cleanup remain explicit in that caller.
   */
  export function close(): void {
    assert.ok(current, "Lint experiment has no workspace owner");
    if (!borrowed) {
      fs.rmSync(current, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
      assert.equal(
        fs.existsSync(current),
        false,
        "Lint consumer workspace remained after cleanup",
      );
    }
    current = undefined;
    borrowed = false;
    producer = "workspace";
  }
}
