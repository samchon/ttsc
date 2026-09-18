import fs from "node:fs";

import { DependencyBuildGeneration } from "./DependencyBuildGeneration";
import { projectModuleOptions } from "./projectModuleOptions";

/**
 * Reuse a dependency another process (or an earlier import) already built.
 *
 * The completion marker names the exact emit generation, so this reads metadata
 * and emit as one unit: it returns a hit only when the marker parses to a valid
 * generation AND that generation's directory holds emitted JavaScript. A reader
 * that runs while a replacement build is populating a DIFFERENT generation
 * directory keeps returning the previous complete generation until the atomic
 * marker swap points at the new one — never a mix of old metadata and a partial
 * new emit.
 *
 * Exported for the ttsx dependency-cache regressions.
 */
export function readDependencyCache(
  cacheDir: string,
  metaPath: string,
): DependencyBuildGeneration.BuiltProject | null {
  let meta: DependencyBuildGeneration.DependencyCacheMeta;
  try {
    meta = JSON.parse(
      fs.readFileSync(metaPath, "utf8"),
    ) as DependencyBuildGeneration.DependencyCacheMeta;
  } catch {
    return null;
  }
  if (
    !DependencyBuildGeneration.isDependencyGeneration(meta.generation) ||
    typeof meta.rootDir !== "string" ||
    // A marker with no `moduleOptions` object predates this field and cannot
    // say which format its emit carries. Treating the absence as "no options"
    // would classify a CommonJS emit as an ES module, so the generation is
    // rejected and rebuilt instead. Every marker this version writes carries
    // the object, empty or not.
    typeof meta.moduleOptions !== "object" ||
    meta.moduleOptions === null ||
    Array.isArray(meta.moduleOptions) ||
    !Array.isArray(meta.outputs) ||
    !meta.outputs.every((output) => typeof output === "string")
  ) {
    return null;
  }
  const emitDir = DependencyBuildGeneration.dependencyGenerationDir(
    cacheDir,
    meta.generation,
  );
  if (!DependencyBuildGeneration.emittedAnything(emitDir)) {
    return null;
  }
  return {
    emitDir,
    outputs: meta.outputs,
    moduleOptions: projectModuleOptions(
      meta.moduleOptions as Record<string, unknown>,
    ),
    // Resolved on the way out, not trusted as written. `rootDir` never gated
    // reuse — the marker's generation, module options, and a non-empty emit do
    // — so a marker carrying an unresolved spelling was already being reused,
    // and every file of that dependency then missed the ownership index's
    // cheap forward mirror. The pass is idempotent and runs only on a hit, which
    // `ensureProjectBuilt` memoizes per tsconfig. Every cache root is scoped to
    // one run or one process and removed with it, so a marker never meets a
    // ttsc other than the one that wrote it.
    rootDir: DependencyBuildGeneration.resolvePhysicalPath(meta.rootDir),
  };
}
