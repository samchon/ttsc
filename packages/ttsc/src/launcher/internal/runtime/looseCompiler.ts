import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { resolveEmittedJavaScript } from "../../../compiler/internal/resolveEmittedJavaScript";
import { runBuild } from "../../../compiler/internal/runBuild";
import { isInside } from "./paths";
import type { RuntimeEnv } from "./runtimeEnv";

/** Directory under the entry emit root that holds loose-compiled sources. */
const LOOSE_DIR = ".ttsx-loose";

interface LooseEmit {
  /** Compiled JavaScript for the source, emitted under `.ttsx-loose`. */
  readonly jsFile: string;
  /** Source modification time the emit was produced from. */
  readonly mtimeMs: number;
}

/** Per-process memo keyed by source file, invalidated by source mtime. */
const looseEmits = new Map<string, LooseEmit>();

/**
 * Compile an entry-project `.ts` that the compile gate did not emit — a source
 * generated at runtime, or reached through a computed `import()` outside the
 * entry's static graph. It is built with the entry project's own tsconfig and
 * plugins (so typia and friends still run) but in isolation: only this file and
 * what it imports, never the inherited `include`, so an unrelated sibling with
 * a type error cannot derail it.
 *
 * The emitted JavaScript is returned, but the caller serves it under the
 * original `.ts` URL so `__filename` / `import.meta.url` keep source identity.
 */
export function compileLooseEntry(
  sourceFile: string,
  runtime: RuntimeEnv,
): string {
  const resolved = path.resolve(sourceFile);
  const mtimeMs = fs.statSync(resolved).mtimeMs;
  const cached = looseEmits.get(resolved);
  if (cached !== undefined && cached.mtimeMs === mtimeMs) {
    return cached.jsFile;
  }
  const jsFile = build(resolved, runtime);
  looseEmits.set(resolved, { jsFile, mtimeMs });
  return jsFile;
}

function build(sourceFile: string, runtime: RuntimeEnv): string {
  // Emit relative to the entry's source root so a sibling import in a parent
  // directory still lands under the loose emit dir instead of polluting the
  // source tree; fall back to the file's own directory for a source that lives
  // outside that root.
  const sourceRoot = isInside(runtime.entrySourceRoot, sourceFile)
    ? runtime.entrySourceRoot
    : path.dirname(sourceFile);
  const emitDir = path.join(
    runtime.entryEmitDir,
    LOOSE_DIR,
    hashSource(sourceFile),
  );
  fs.rmSync(emitDir, { recursive: true, force: true });
  fs.mkdirSync(emitDir, { recursive: true });
  const configFile = path.join(emitDir, "tsconfig.ttsx-loose.json");
  fs.writeFileSync(
    configFile,
    JSON.stringify({
      extends: runtime.entryTsconfig,
      compilerOptions: { outDir: emitDir, rootDir: sourceRoot },
      files: [sourceFile],
      include: [],
    }),
    "utf8",
  );

  const result = runBuild({
    binary: runtime.tsgoBinary,
    cacheDir: runtime.cacheDir,
    cwd: runtime.entryRoot,
    emit: true,
    forceListEmittedFiles: true,
    outDir: emitDir,
    plugins: runtime.noPlugins ? false : undefined,
    projectRoot: runtime.entryRoot,
    quiet: true,
    tsconfig: configFile,
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `ttsx: failed to compile ${sourceFile}`,
        (result.stderr || result.stdout).trim(),
      ]
        .filter((line) => line.length !== 0)
        .join("\n"),
    );
  }
  const jsFile = resolveEmittedJavaScript({
    outDir: emitDir,
    projectRoot: sourceRoot,
    sourceFile,
  });
  if (jsFile === null) {
    throw new Error(`ttsx: no emitted JavaScript was found for ${sourceFile}`);
  }
  return jsFile;
}

function hashSource(sourceFile: string): string {
  return crypto
    .createHash("sha256")
    .update(sourceFile)
    .digest("hex")
    .slice(0, 16);
}
