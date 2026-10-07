import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import * as mod from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies VS Code dynamic client planning replaces overlapping roots.
 *
 * The extension may first start a nested package server, then later need a
 * parent server for a sibling file outside that nested package. Because VS Code
 * document selectors cannot exclude the nested subtree, the extension stops
 * overlapping clients before starting the newly selected root.
 *
 * 1. Call the authored server resolution helper in the unit process.
 * 2. Ask which roots overlap a parent target.
 * 3. Ask which roots overlap a nested target.
 * 4. Assert only overlapping roots are selected for replacement.
 *
 * @evidence contracts/testing.md#behavioral-verification rootsToStopForTarget identifies conflicts when selecting parent or nested clients.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored literals from the one-owner-per-document rule: an existing nested client must stop when its ancestor becomes the target, and an existing ancestor must stop when a nested target starts, while a sibling directory must not.
 * @evidence contracts/testing.md#distinguishing-cases Target=parent with running [nested] returns the nested root; target=nested with running [root, sibling] returns only the root and keeps the sibling, so overlap is directional in both ways and a non-overlapping sibling is retained. Alias, equal-root and case-variant targets are not covered.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttscserver; it calls the actual selector over missing child paths in a fresh tracked temporary parent. Native absence assertions establish missing-suffix resolution; the actual context may invoke Windows read-only fsutil case observation. No language client, compiler or user program starts.
 */
export function test_vscode_server_resolution_replaces_overlapping_client_roots() {
  const root = path.join(
    TestProject.tmpdir("vscode-stop-missing-roots-"),
    "repo",
  );
  const nested = path.join(root, "packages", "demo");
  const sibling = path.join(root, "tools");
  for (const entry of [root, nested, sibling])
    assert.equal(fs.existsSync(entry), false);
  const observed = (() => {
    return {
      parent: mod.rootsToStopForTarget([nested], root),
      child: mod.rootsToStopForTarget([root, sibling], nested),
    };
  })();
  const actual = observed as {
    child: string[];
    parent: string[];
  };
  assert.deepEqual(
    actual.parent.map((entry) => path.normalize(entry)),
    [path.normalize(nested)],
  );
  assert.deepEqual(
    actual.child.map((entry) => path.normalize(entry)),
    [path.normalize(root)],
  );
}
