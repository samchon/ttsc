import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Establish a placement fixture's absence of an ambient ancestor workspace.
 *
 * A workspace marker or nonempty package list outranks installation boundaries;
 * disabled or empty declarations do not. Preparation checks native inputs,
 * never asks the cache resolver for the expected answer. A malformed ancestor
 * manifest is a preparation failure, not product rejection or execution
 * success.
 */
export function assertNoAncestorWorkspace(root: string): void {
  for (let ancestor = path.dirname(root); ; ) {
    assert.equal(
      fs.existsSync(path.join(ancestor, "pnpm-workspace.yaml")),
      false,
      "ambient workspace marker: " + ancestor,
    );
    const manifest = path.join(ancestor, "package.json");
    if (fs.existsSync(manifest)) {
      const ambient: unknown = JSON.parse(fs.readFileSync(manifest, "utf8"));
      if (typeof ambient === "object" && ambient !== null) {
        const workspace: unknown = (ambient as { workspaces?: unknown })
          .workspaces;
        const packages: unknown = Array.isArray(workspace)
          ? workspace
          : typeof workspace === "object" && workspace !== null
            ? (workspace as { packages?: unknown }).packages
            : undefined;
        assert.equal(
          Array.isArray(packages) && packages.length > 0,
          false,
          "ambient workspace declaration: " + manifest,
        );
      }
    }
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
}
