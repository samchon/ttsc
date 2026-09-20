import assert from "node:assert/strict";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.mjs";
import { pathTraversesSymbolicLink } from "../../../../../packages/unplugin/lib/core/transform/tracker/pathTraversesSymbolicLink.mjs";

/**
 * Verifies a tracker keeps covering an input below a linked root, and still
 * refuses one below a link inside the root (samchon/ttsc#1459).
 *
 * The walk examined every component up to the volume root, so a project below a
 * link, every macOS temporary directory among them, covered nothing: every
 * delivery re-read each candidate and input. A link at or above the watched
 * directory is re-checked by identity on every delivery instead, so only the
 * components between the input and the root decide.
 *
 * 1. On a filesystem where the project root's parent is a link, assert an input
 *    below the root does not traverse a link when the root is given, and does
 *    when it is not.
 * 2. Assert an input below a link inside the root traverses one, and an input
 *    outside the root is examined all the way up.
 */
export async function test_tracker_coverage_stops_at_the_watched_root(): Promise<void> {
  const root = path.resolve("/var/tmp/project");
  const links = new Set([
    path.resolve("/var"),
    path.join(root, "node_modules", "linked"),
  ]);
  const filesystem = {
    ...DEFAULT_FILESYSTEM_OPERATIONS,
    lstat: (location: string) =>
      ({
        isDirectory: () => true,
        isFile: () => false,
        isSymbolicLink: () => links.has(path.resolve(location)),
        nlink: 1n,
      }) as never,
  };
  const memo = () => new Map<string, boolean>();
  const input = path.join(root, "src", "main.ts");

  assert.equal(
    pathTraversesSymbolicLink(input, filesystem, memo(), root),
    false,
    "the root's own ancestors are the root's identity check's business",
  );
  assert.equal(
    pathTraversesSymbolicLink(input, filesystem, memo()),
    true,
    "without a root, every component up to the volume root counts",
  );
  assert.equal(
    pathTraversesSymbolicLink(
      path.join(root, "node_modules", "linked", "index.d.ts"),
      filesystem,
      memo(),
      root,
    ),
    true,
    "a link inside the root still moves an input silently",
  );
  assert.equal(
    pathTraversesSymbolicLink(
      path.resolve("/var/tmp/elsewhere/index.d.ts"),
      filesystem,
      memo(),
      root,
    ),
    true,
    "an input outside the root is examined all the way up",
  );
}
