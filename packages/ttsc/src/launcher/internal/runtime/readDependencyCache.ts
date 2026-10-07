import fs from "node:fs";

import { DependencyBuildGeneration } from "./DependencyBuildGeneration";
import { RuntimeEmitProvenance } from "./RuntimeEmitProvenance";
import { projectModuleOptions } from "./projectModuleOptions";

/**
 * Reuse a dependency another process (or an earlier import) already built.
 *
 * The marker selects one generation, then a separate native walk checks for
 * JavaScript presence. With cooperative publication, noncolliding ids and
 * retained immutable generations, replacement builds leave the previous
 * marker's directory available until marker replacement. These sequential reads
 * do not pin an artifact snapshot or authenticate its current bytes.
 *
 * Unreadable, malformed or incomplete markers are cache misses and leave
 * rebuilding to the dependency-build owner.
 *
 * Markers without the producer's emit-provenance record shape are historical
 * misses even when output filenames resemble the requested source. Shape
 * validation preserves supplied observations; it does not authenticate their
 * producer or establish current artifact integrity.
 *
 * @evidence contracts/common.md#principled-implementation Metadata and provenance shape checks select one JavaScript-bearing generation under cooperative publication/retention premises; malformed or legacy records are misses without reconstructing membership from filenames or authenticating supplied observations.
 * @evidence contracts/common.md#clear-and-simple-design Marker decoding, generation selection and the built-project result form one read boundary; module-option projection and physical identity use their shared owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing historical module, output or emitted-source fields trigger owning rebuild rather than guessing emit format or reconstructing source membership from a stem.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish sequential marker/presence reads and cooperative publication from artifact or producer authentication, and explain historical misses and root context.
 * @evidence contracts/portability.md#os-neutral-implementation Native fs and generation path construction preserve platform spelling; the source root uses the shared filesystem-identity resolver with its documented best-effort fallback.
 * @evidence contracts/performance.md#efficient-algorithms Reading/parsing costs uncapped marker bytes; output and provenance checks process entries and native path text. The early-exit emit walk costs visited entries/listings/name/path text and active recursion listings/depth. Root resolution adds delegated identity-context/native case observations; no fixed metadata-check count bounds that work.
 * @evidence contracts/performance.md#reuse-equivalent-work The caller supplies the computed cache directory; ensureProjectBuilt memoizes success/failure by that directory, including selected compiler identity, while a miss reaches build admission. This reader validates current marker shape and presence each invocation but does not independently authenticate producer records, immutable retention or the caller's cache-key equivalence.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Marker text, decoded metadata, validation pairs and native-walk/context temporaries are call-local; returned arrays/records escape to the caller's build cache. Synchronous reads retain no handle here, while the caller owns cached metadata and generation storage lifetime; this reader imposes no historical quota or artifact-release policy.
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
