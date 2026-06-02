import { typeScriptForTarget } from "./packageTarget";
import {
  findOwningPackageRoot,
  isTypeScriptSource,
  javaScriptForTarget,
  realPath,
} from "./paths";
import type { RuntimeEnv } from "./runtimeEnv";

/** How a requested module is classified for source-identity serving. */
export type Resolution =
  | {
      /** A raw `.ts` owned by a dependency package: compiled into its cache. */
      readonly kind: "dependency";
      readonly source: string;
      readonly packageRoot: string;
    }
  | {
      /** A raw `.ts` owned by the entry project: gate emit, or loose-compiled. */
      readonly kind: "entry";
      readonly source: string;
    }
  | {
      /** An existing JavaScript file to load verbatim (extensionless rescue). */
      readonly kind: "file";
      readonly file: string;
    };

/**
 * Classify a TypeScript source Node resolved to. A `.ts` owned by a package
 * other than the entry project is a dependency; any other `.ts` belongs to the
 * entry project. Returns `null` for non-TypeScript files so the caller leaves
 * them to Node. The owning package is matched against both the entry root and
 * its real path so a source reached through a symlinked workspace directory is
 * still recognised as an entry source.
 */
export function classifyExisting(
  absolutePath: string,
  runtime: RuntimeEnv,
): Extract<Resolution, { kind: "dependency" | "entry" }> | null {
  if (!isTypeScriptSource(absolutePath)) {
    return null;
  }
  const owner = findOwningPackageRoot(realPath(absolutePath));
  if (
    owner !== null &&
    owner !== runtime.entryRoot &&
    owner !== runtime.entryRealRoot
  ) {
    return { kind: "dependency", source: absolutePath, packageRoot: owner };
  }
  return { kind: "entry", source: absolutePath };
}

/**
 * Classify a module target Node could not resolve to an existing file: the
 * TypeScript counterpart of a `.js` entry target or extensionless stem, then an
 * existing JavaScript file (an extensionless import inside compiled output).
 * Returns `null` when nothing backs the target so the caller can preserve
 * Node's original error.
 */
export function classifyMissing(
  target: string,
  runtime: RuntimeEnv,
): Resolution | null {
  const source = typeScriptForTarget(target);
  if (source !== null) {
    return classifyExisting(source, runtime);
  }
  const javaScript = javaScriptForTarget(target);
  if (javaScript !== null) {
    return { kind: "file", file: javaScript };
  }
  return null;
}

/**
 * The file a resolution should load. A dependency or entry source resolves to
 * its own path (the hooks serve its compiled bytes under that identity); an
 * extensionless rescue resolves to the existing JavaScript file.
 */
export function targetPath(resolution: Resolution): string {
  return resolution.kind === "file" ? resolution.file : resolution.source;
}
