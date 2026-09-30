import assert from "node:assert/strict";
import path from "node:path";

import * as transformer from "../../../../packages/metro/src/transformer";

/** A fully-resolved options object for `shouldTransform` unit tests. */
function resolvedOptions(extra: Record<string, unknown> = {}): any {
  return {
    ttsc: {},
    include: [],
    exclude: [],
    upstreamTransformer: undefined,
    ...extra,
  };
}

/**
 * Asserts Metro's project-relative `filename` is resolved against
 * `options.projectRoot` (not `process.cwd()`). The core of the silent-no-op
 * bug: in monorepos cwd ≠ projectRoot, so resolving against cwd points the ttsc
 * pass at the wrong path and every file looks "outside the project".
 */
export async function assertResolvesRelativeFilenameAgainstProjectRoot(): Promise<void> {
  const mod = transformer;
  assert.equal(
    mod.resolveAbsoluteFilename("src/app.ts", {
      projectRoot: "/workspace/app",
    }),
    path.resolve("/workspace/app", "src/app.ts"),
  );
  // No projectRoot → falls back to cwd.
  assert.equal(
    mod.resolveAbsoluteFilename("src/app.ts", {}),
    path.resolve(process.cwd(), "src/app.ts"),
  );
  // No options object at all → also falls back to cwd.
  assert.equal(
    mod.resolveAbsoluteFilename("src/app.ts"),
    path.resolve(process.cwd(), "src/app.ts"),
  );
}

/**
 * Asserts an already-absolute `filename` is returned unchanged, ignoring
 * `projectRoot` (the `path.isAbsolute` short-circuit).
 */
export async function assertKeepsAbsoluteFilenameUnchanged(): Promise<void> {
  const mod = transformer;
  const absolute = path.resolve("/workspace/app/src/app.ts");
  assert.equal(
    mod.resolveAbsoluteFilename(absolute, { projectRoot: "/somewhere/else" }),
    absolute,
  );
}

/**
 * Asserts `shouldTransform` accepts every TypeScript source extension
 * (`.ts`/`.tsx`/`.cts`/`.mts`).
 */
export async function assertAcceptsAllTypeScriptExtensions(): Promise<void> {
  const mod = transformer;
  for (const file of ["/p/a.ts", "/p/a.tsx", "/p/a.cts", "/p/a.mts"]) {
    assert.equal(mod.shouldTransform(file, resolvedOptions()), true, file);
  }
}

/**
 * Asserts `shouldTransform` rejects every neighboring non-source spelling,
 * declaration form, virtual id, and dependency path through the shared gate.
 */
export async function assertRejectsNonTypeScriptExtensions(): Promise<void> {
  const mod = transformer;
  for (const file of [
    "/p/a.d.ts",
    "/p/a.d.mts",
    "/p/a.d.cts",
    "/p/a.d.css.ts",
    "/p/a.js",
    "/p/a.jsx",
    "/p/a.mjs",
    "/p/a.cjs",
    "/p/a.mtsx",
    "/p/a.ctsx",
    "/p/a.json",
    "/p/a.css",
    "/p/node_modules/pkg/a.ts",
    "\0virtual.ts",
  ]) {
    assert.equal(mod.shouldTransform(file, resolvedOptions()), false, file);
  }
}

/**
 * Asserts the include/exclude gating: empty include = all TypeScript; a
 * matching include selects, a non-matching include rejects; exclude rejects and
 * wins over a matching include.
 */
export async function assertGatesByIncludeAndExclude(): Promise<void> {
  const mod = transformer;
  const ts = "/p/src/keep/a.ts";
  assert.equal(
    mod.shouldTransform(ts, resolvedOptions()),
    true,
    "empty include",
  );
  assert.equal(
    mod.shouldTransform(ts, resolvedOptions({ include: ["keep"] })),
    true,
    "include match",
  );
  assert.equal(
    mod.shouldTransform(
      "/p/src/other/a.ts",
      resolvedOptions({ include: ["keep"] }),
    ),
    false,
    "include non-match",
  );
  assert.equal(
    mod.shouldTransform(ts, resolvedOptions({ exclude: ["keep"] })),
    false,
    "exclude match",
  );
  assert.equal(
    mod.shouldTransform(
      ts,
      resolvedOptions({ include: ["keep"], exclude: ["keep"] }),
    ),
    false,
    "exclude wins over include",
  );
}