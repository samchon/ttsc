import * as fs from "node:fs";
import * as path from "node:path";

/** Locate the JavaScript file emitted for a TypeScript source file. */
export function resolveEmittedJavaScript(options: {
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
  for (const file of options.emittedFiles ?? listJavaScriptFiles(options.outDir)) {
    if (!isJavaScriptOutput(file)) continue;
    const score = sharedSourceStemSegments(file, options.sourceFile);
    if (score > bestScore) {
      best = file;
      bestScore = score;
    }
  }
  return best && fs.existsSync(best) ? best : null;
}

function resolveExactEmittedFile(
  outDir: string,
  projectRoot: string,
  sourceFile: string,
): string | null {
  const relative = path.relative(projectRoot, sourceFile);
  if (
    relative === "" ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    return null;
  }
  return path.resolve(
    outDir,
    relative.slice(0, relative.length - path.extname(relative).length) +
      emittedJavaScriptExtension(sourceFile),
  );
}

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

function sharedSourceStemSegments(outPath: string, srcPath: string): number {
  const trim = (location: string): string[] => {
    const normalized = location.replace(/\\/g, "/");
    return normalized
      .slice(0, normalized.length - path.extname(normalized).length)
      .split("/");
  };
  const a = trim(outPath);
  const b = trim(srcPath);
  const count = Math.min(a.length, b.length);
  let shared = 0;
  for (let i = 1; i <= count; i += 1) {
    if (a[a.length - i] !== b[b.length - i]) break;
    shared += 1;
  }
  return shared;
}

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

function isJavaScriptOutput(filename: string): boolean {
  return /\.(?:[cm]?js)$/i.test(filename);
}
