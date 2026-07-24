import assert from "node:assert/strict";
import path from "node:path";

import { createProjectInputPathIdentityContext } from "../../../../../packages/ttsc/lib/internal/projectInputPathIdentity.js";

/**
 * Verifies missing suffixes inherit their existing ancestor's case semantics.
 *
 * Physical aliases always converge. Missing names converge only when their
 * owning directory is case-insensitive; a case-sensitive directory preserves
 * both declarations.
 */
export const test_project_input_path_identity_respects_directory_case_semantics =
  (): void => {
    const root = path.resolve("virtual-project-input-root");
    const physical = path.join(root, "Physical");
    const alias = path.join(root, "Alias");
    const realpath = (location: string): string => {
      if (location === physical || location === alias) return physical;
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    };
    const insensitive = createProjectInputPathIdentityContext({
      caseSensitive: () => false,
      realpath,
    });
    const sensitive = createProjectInputPathIdentityContext({
      caseSensitive: () => true,
      realpath,
    });

    assert.deepEqual(
      insensitive.resolve(path.join(alias, "Future", "Spec.md")),
      {
        key: path.join(physical, "future", "spec.md"),
        path: path.join(physical, "future", "spec.md"),
      },
    );
    assert.equal(
      insensitive.resolve(path.join(alias, "future", "spec.md")).key,
      insensitive.resolve(path.join(alias, "Future", "Spec.md")).key,
    );
    assert.notEqual(
      sensitive.resolve(path.join(alias, "future", "spec.md")).key,
      sensitive.resolve(path.join(alias, "Future", "Spec.md")).key,
    );
  };
