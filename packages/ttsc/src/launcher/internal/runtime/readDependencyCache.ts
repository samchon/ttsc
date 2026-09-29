import fs from "node:fs";

import { DependencyBuildGeneration } from "./DependencyBuildGeneration";
import { RuntimeEmitProvenance } from "./RuntimeEmitProvenance";
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
 * Unreadable, malformed or incomplete markers are cache misses and leave
 * rebuilding to the dependency-build owner.
 *
 * Markers without actual compiler emit provenance are historical misses even
 * when their output filenames resemble the requested source.
 *
 * @evidence contracts/common.md#principled-implementation Validated metadata and actual emit provenance select one immutable JavaScript-bearing generation; malformed or legacy records are misses, preventing publication mixing and filename-based guesses about source membership.
 * @evidence contracts/common.md#clear-and-simple-design Marker decoding, generation selection and the built-project result form one read boundary; module-option projection and physical identity use their shared owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing historical module, output or emitted-source fields trigger owning rebuild rather than guessing emit format or reconstructing source membership from a stem.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain atomic generation publication and miss behavior; returned source identity and invalid historical markers are documented where they matter.
 * @evidence contracts/portability.md#os-neutral-implementation Native fs and generation path construction preserve platform spelling; the source root uses the shared filesystem-identity resolver with its documented best-effort fallback.
 * @evidence contracts/performance.md#efficient-algorithms Parsing costs marker bytes and output entries; the emit walk stops at the first JavaScript file, with worst-case O(E) directory entries and recursion depth equal to tree depth.
 * @evidence contracts/performance.md#reuse-equivalent-work The published generation binds metadata to immutable emit; ensureProjectBuilt memoizes by the computed cache directory including current compiler proof, while an invalid marker requests new compilation.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The read returns build metadata to its caller and closes synchronous reads immediately; generation directories are owned and reclaimed by the dependency cache container, not this reader.
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
    meta === null ||
    typeof meta !== "object" ||
    Array.isArray(meta) ||
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
    (meta.moduleOptions.module !== undefined &&
      typeof meta.moduleOptions.module !== "string") ||
    (meta.moduleOptions.target !== undefined &&
      typeof meta.moduleOptions.target !== "string") ||
    !Array.isArray(meta.outputs) ||
    !meta.outputs.every((output) => typeof output === "string") ||
    !RuntimeEmitProvenance.isRecord(meta.emittedSources)
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
    emittedSources: meta.emittedSources,
    emittedSourceProofFailures: meta.emittedSourceProofFailures,
    moduleOptions: projectModuleOptions(
      meta.moduleOptions as Record<string, unknown>,
    ),
    // Resolve source-root context through the shared native identity owner.
    // Exact source ownership comes from captured emittedSources, not this
    // root's spelling or a reconstruction of the output layout.
    rootDir: DependencyBuildGeneration.resolvePhysicalPath(meta.rootDir),
  };
}
