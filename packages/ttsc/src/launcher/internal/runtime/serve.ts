import fs from "node:fs";

import { resolveExactEmittedJavaScript } from "../../../compiler/internal/resolveEmittedJavaScript";
import { classifyExisting } from "./classify";
import { resolveDependencyJavaScript } from "./dependencyCompiler";
import { compileLooseEntry } from "./looseCompiler";
import { detectModuleFormat } from "./moduleSyntax";
import type { RuntimeEnv } from "./runtimeEnv";
import { restoreSourceImportBindings } from "./sourceBindings";

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
  const format = detectModuleFormat(source, code);
  // CommonJS output can keep a source identifier a transform left behind after
  // tsgo rewrote the import to a `require()` alias; reconnect those bindings.
  return {
    code:
      format === "commonjs"
        ? restoreSourceImportBindings(fs.readFileSync(source, "utf8"), code)
        : code,
    format,
  };
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
  // Exact layout mirror only: a gate emit absent here means the source was
  // never emitted (generated at runtime, or outside the static include), so it
  // must be loose-compiled — not fuzzy-matched to an unrelated emitted file
  // that merely shares a basename.
  const emitted = resolveExactEmittedJavaScript({
    outDir: runtime.entryEmitDir,
    projectRoot: runtime.entrySourceRoot,
    sourceFile: classified.source,
  });
  return emitted ?? compileLooseEntry(classified.source, runtime);
}
