import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Establish a placement fixture's absence of an ambient ancestor workspace.
 *
 * Workspace declarations legitimately outrank authored installation boundaries.
 * This preparation checks native inputs, never asks the cache resolver for the
 * expected answer. A malformed ancestor manifest is a preparation failure;
 * no product rejection or execution success is inferred from that failure.
 */
export function assertNoAncestorWorkspace(root: string): void {
  for (let ancestor = path.dirname(root);;) {
    assert.equal(fs.existsSync(path.join(ancestor, "pnpm-workspace.yaml")), false, "ambient workspace marker: " + ancestor);
    const manifest = path.join(ancestor, "package.json");
    if (fs.existsSync(manifest)) {
      const ambient: unknown = JSON.parse(fs.readFileSync(manifest, "utf8"));
      if (typeof ambient === "object" && ambient !== null)
        assert.equal(Object.prototype.hasOwnProperty.call(ambient, "workspaces"), false, "ambient workspace declaration: " + manifest);
    }
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
}
