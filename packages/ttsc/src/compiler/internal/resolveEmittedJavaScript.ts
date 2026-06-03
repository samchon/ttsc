import fs from "node:fs";
import path from "node:path";

import { isOutsideRelativePath } from "./paths";

/**
 * Locate the JavaScript file emitted for a TypeScript source file.
 *
 * Resolution strategy:
 *
 * 1. Try to derive the exact output path by mirroring the source's relative
 *    position inside `projectRoot` into `outDir`, applying the correct JS
 *    extension (`.js` / `.mjs` / `.cjs`). Use this path if it exists on disk.
 * 2. Fall back to scoring each candidate in `emittedFiles` (or a recursive
 *    directory scan of `outDir`) by the number of trailing path-stem segments
 *    shared with the source file name, and pick the highest-scoring existing
 *    file.
 *
 * Returns `null` when no matching output file is found on disk.
 */
export function resolveEmittedJavaScript(options: {
  /** Pre-computed list of emitted paths; when absent `outDir` is scanned. */
  emittedFiles?: readonly string[];
  outDir: string;
  projectRoot: string;
  sourceFile: string;
}): string | null {
  const exact = resolveExactEmittedFile(
    options.outDir,
    options.projectRoot,
    options.sourceFile,
  );
  if (exact && fs.existsSync(exact)) {
    return exact;
  }

  let best: string | null = null;
  let bestScore = 0;
  for (const file of options.emittedFiles ??
    listJavaScriptFiles(options.outDir)) {
    if (!isJavaScriptOutput(file)) continue;
    const score = sharedSourceStemSegments(file, options.sourceFile);
    if (score > bestScore) {
      best = file;
      bestScore = score;
    }
  }
  return best && fs.existsSync(best) ? best : null;
}

/**
 * Derive the exact output path for `sourceFile` by mirroring its position
 * relative to `projectRoot` into `outDir`. Returns `null` when the source is
 * not inside the project root or when the path cannot be determined.
 */
function resolveExactEmittedFile(
  outDir: string,
  projectRoot: string,
  sourceFile: string,
): string | null {
  const relative = path.relative(projectRoot, sourceFile);
  if (relative === "" || isOutsideRelativePath(relative)) {
    return null;
  }
  return path.resolve(
    outDir,
    relative.slice(0, relative.length - path.extname(relative).length) +
      emittedJavaScriptExtension(sourceFile),
  );
}

/**
 * Recursively enumerate every JavaScript output file under `root`. Uses an
 * explicit stack instead of recursion to avoid call-stack overflow on deep
 * directory trees. Non-existent roots are silently skipped.
 */
function listJavaScriptFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length !== 0) {
    const current = stack.pop()!;
    if (!fs.existsSync(current)) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
      } else if (entry.isFile() && isJavaScriptOutput(next)) {
        out.push(path.resolve(next));
      }
    }
  }
  return out;
}

/**
 * Count the number of consecutive trailing path-stem segments that `outPath`
 * and `srcPath` share when both are stripped of their extensions and normalised
 * to forward slashes.
 *
 * Example: `dist/lib/foo.js` vs `src/lib/foo.ts` → 2 (`lib`, `foo`).
 */
function sharedSourceStemSegments(outPath: string, srcPath: string): number {
  const stripExtAndSplit = (location: string): string[] => {
    const normalized = location.replace(/\\/g, "/");
    return normalized
      .slice(0, normalized.length - path.extname(normalized).length)
      .split("/");
  };
  const a = stripExtAndSplit(outPath);
  const b = stripExtAndSplit(srcPath);
  const count = Math.min(a.length, b.length);
  let shared = 0;
  for (let i = 1; i <= count; i += 1) {
    if (a[a.length - i] !== b[b.length - i]) break;
    shared += 1;
  }
  return shared;
}

/**
 * Map a TypeScript source extension to its JavaScript output counterpart.
 * `.mts` → `.mjs`, `.cts` → `.cjs`, everything else → `.js`.
 */
function emittedJavaScriptExtension(filename: string): string {
  switch (path.extname(filename).toLowerCase()) {
    case ".mts":
      return ".mjs";
    case ".cts":
      return ".cjs";
    default:
      return ".js";
  }
}

/** Return true when `filename` has a `.js`, `.mjs`, or `.cjs` extension. */
function isJavaScriptOutput(filename: string): boolean {
  return /\.(?:[cm]?js)$/i.test(filename);
}
