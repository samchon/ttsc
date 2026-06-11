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
export interface EmittedJavaScriptResolverOptions {
  /** Pre-computed list of emitted paths; when absent `outDir` is scanned. */
  emittedFiles?: readonly string[];
  outDir: string;
  projectRoot: string;
  /**
   * Whether to scan `outDir` when `emittedFiles` does not identify a match.
   * Defaults to true. Set to false only when `emittedFiles` is already a
   * complete snapshot of the JavaScript outputs.
   */
  scanOutDir?: boolean;
}

export interface EmittedJavaScriptResolver {
  resolve(sourceFile: string): string | null;
}

export function resolveEmittedJavaScript(
  options: EmittedJavaScriptResolverOptions & {
    sourceFile: string;
  },
): string | null {
  const exact = resolveExactEmittedFile(
    options.outDir,
    options.projectRoot,
    options.sourceFile,
  );
  if (exact && fs.existsSync(exact)) {
    return exact;
  }

  // Score the pre-computed emit list first. When it yields nothing because the
  // list is incomplete, or because tsgo shifted the output prefix, fall back to
  // scanning `outDir`. Trailing-stem scoring still pins the right file.
  const primary = bestStemMatch(
    options.emittedFiles ??
      (options.scanOutDir === false
        ? []
        : listEmittedJavaScriptFiles(options.outDir)),
    options.sourceFile,
  );
  if (primary !== null && fs.existsSync(primary)) {
    return primary;
  }
  if (options.emittedFiles !== undefined && options.scanOutDir !== false) {
    const fromDir = bestStemMatch(
      listEmittedJavaScriptFiles(options.outDir),
      options.sourceFile,
    );
    if (fromDir !== null && fs.existsSync(fromDir)) {
      return fromDir;
    }
  }
  return null;
}

export function createEmittedJavaScriptResolver(
  options: EmittedJavaScriptResolverOptions,
): EmittedJavaScriptResolver {
  const primary = createStemMatcher(
    options.emittedFiles ??
      (options.scanOutDir === false
        ? []
        : listEmittedJavaScriptFiles(options.outDir)),
  );
  let scanned: StemMatcher | undefined;

  return {
    resolve(sourceFile) {
      const exact = resolveExactEmittedFile(
        options.outDir,
        options.projectRoot,
        sourceFile,
      );
      if (exact && fs.existsSync(exact)) {
        return exact;
      }

      const fromPrimary = primary.match(sourceFile);
      if (fromPrimary !== null && fs.existsSync(fromPrimary)) {
        return fromPrimary;
      }
      if (options.emittedFiles !== undefined && options.scanOutDir !== false) {
        scanned ??= createStemMatcher(
          listEmittedJavaScriptFiles(options.outDir),
        );
        const fromDir = scanned.match(sourceFile);
        if (fromDir !== null && fs.existsSync(fromDir)) {
          return fromDir;
        }
      }
      return null;
    },
  };
}

/** Highest trailing-stem-scoring JavaScript output among `files`, or `null`. */
function bestStemMatch(
  files: readonly string[],
  sourceFile: string,
): string | null {
  let best: string | null = null;
  let bestScore = 0;
  for (const file of files) {
    if (!isJavaScriptOutput(file)) continue;
    const score = sharedSourceStemSegments(file, sourceFile);
    if (score > bestScore) {
      best = file;
      bestScore = score;
    }
  }
  return best;
}

interface StemMatcher {
  match(sourceFile: string): string | null;
}

function createStemMatcher(files: readonly string[]): StemMatcher {
  const bySuffix = new Map<string, string>();
  for (const file of files) {
    if (!isJavaScriptOutput(file)) continue;
    const segments = pathStemSegments(file);
    for (let index = 0; index < segments.length; index += 1) {
      const key = segments.slice(index).join("/");
      if (!bySuffix.has(key)) {
        bySuffix.set(key, file);
      }
    }
  }

  return {
    match(sourceFile) {
      const segments = pathStemSegments(sourceFile);
      for (let index = 0; index < segments.length; index += 1) {
        const file = bySuffix.get(segments.slice(index).join("/"));
        if (file !== undefined) {
          return file;
        }
      }
      return null;
    },
  };
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
export function listEmittedJavaScriptFiles(root: string): string[] {
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
 * Count the consecutive trailing path-stem segments shared by `outPath` and
 * `srcPath` after both are stripped of their extensions and normalized.
 *
 * Example: `dist/lib/foo.js` vs `src/lib/foo.ts` returns 2 (`lib`, `foo`).
 */
function sharedSourceStemSegments(outPath: string, srcPath: string): number {
  const a = pathStemSegments(outPath);
  const b = pathStemSegments(srcPath);
  const count = Math.min(a.length, b.length);
  let shared = 0;
  for (let i = 1; i <= count; i += 1) {
    if (a[a.length - i] !== b[b.length - i]) break;
    shared += 1;
  }
  return shared;
}

function pathStemSegments(location: string): string[] {
  const normalized = location.replace(/\\/g, "/");
  return normalized
    .slice(0, normalized.length - path.extname(normalized).length)
    .split("/");
}

/**
 * Map a TypeScript source extension to its JavaScript output counterpart.
 * `.mts` maps to `.mjs`, `.cts` maps to `.cjs`, everything else maps to `.js`.
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
