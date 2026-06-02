import fs from "node:fs";

import { resolveEmittedJavaScript } from "../../../compiler/internal/resolveEmittedJavaScript";
import { classifyExisting } from "./classify";
import { resolveDependencyJavaScript } from "./dependencyCompiler";
import { compileLooseEntry } from "./looseCompiler";
import { detectModuleFormat } from "./moduleSyntax";
import type { RuntimeEnv } from "./runtimeEnv";

/** A TypeScript source's compiled bytes and the format Node should load them as. */
export interface ServedModule {
  readonly code: string;
  readonly format: "module" | "commonjs";
}

/**
 * Produce the compiled JavaScript and module format for a TypeScript source,
 * served under the source's own identity. A dependency source comes from its
 * package cache; an entry source comes from the compile-gate emit, or is
 * loose-compiled when the gate never emitted it (a source generated at runtime
 * or reached outside the entry's static graph). Returns `null` for a path that
 * is not a TypeScript source.
 */
export function serveTypeScript(
  source: string,
  runtime: RuntimeEnv,
): ServedModule | null {
  const classified = classifyExisting(source, runtime);
  if (classified === null) {
    return null;
  }
  const jsFile = compiledJavaScript(classified, runtime);
  const code = fs.readFileSync(jsFile, "utf8");
  return { code, format: detectModuleFormat(source, code) };
}

function compiledJavaScript(
  classified: NonNullable<ReturnType<typeof classifyExisting>>,
  runtime: RuntimeEnv,
): string {
  if (classified.kind === "dependency") {
    return resolveDependencyJavaScript(
      classified.source,
      runtime,
      classified.packageRoot,
    );
  }
  const emitted = resolveEmittedJavaScript({
    outDir: runtime.entryEmitDir,
    projectRoot: runtime.entrySourceRoot,
    sourceFile: classified.source,
  });
  return emitted ?? compileLooseEntry(classified.source, runtime);
}
