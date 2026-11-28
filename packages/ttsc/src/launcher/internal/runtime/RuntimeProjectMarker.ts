import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { systemTempOutsideProject } from "../../../internal/systemTempOutsideProject";
import { isPathWithin } from "../../../plugin/internal/source/isPathWithin";
import { RuntimeFilesystem } from "./RuntimeFilesystem";

/**
 * Verify project markers emitted by a compiler that can reformat JSON.
 * Publication observes both files for an output with one compiler-proved
 * source. Cleanup and reuse verify each file against its own observed bytes.
 * Older records can still prove a byte-identical copy.
 *
 * @evidence contracts/common.md#principled-implementation Only a compiler-owned JSON marker with one physical source can produce byte observations. Each file is independently rechecked against them on use.
 * @evidence contracts/common.md#clear-and-simple-design Runtime manifests and dependency generations share marker capture and verification.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Output spelling alone, ambiguous contributors, renamed entries and unobserved content do not authorize cleanup.
 * @evidence contracts/common.md#meaningful-documentation Describes why source and output bytes are independently observed and how historical records behave.
 * @evidence contracts/portability.md#os-neutral-implementation Native path containment, regular-file reads and physical witnesses select the two files.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Algorithms belong to the operations grouped here.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The grouping holds no shared result cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The grouping holds no filesystem resource.
 */
export namespace RuntimeProjectMarker {
  /**
   * Verifiable byte observations indexed by the compiler's native output path.
   * Each digest describes its own file before run cleanup or dependency reuse.
   *
   * @evidence contracts/common.md#principled-implementation An output coordinate binds separately named source and output byte observations.
   * @evidence contracts/common.md#clear-and-simple-design One serializable mapping carries the observation per compiler marker without retaining file content.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A source digest cannot stand in for a potentially reformatted output digest.
   * @evidence contracts/common.md#meaningful-documentation The type names the native index and which bytes each value describes.
   * @evidence contracts/portability.md#os-neutral-implementation Compiler coordinates retain native syntax and hash strings need no platform conversion.
   * @evidenceExclude contracts/performance.md#efficient-algorithms The type describes stored data, not the read or hash algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Checking the stored proof belongs to its consumer.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This data type acquires no resources.
   */
  export type Proofs = Readonly<
    Record<string, { readonly source: string; readonly output: string }>
  >;

  /**
   * Observe the actual regular files for marked writes in this emit directory.
   * The ledger is supplied by the completed compiler, and path observations
   * depend on a stable namespace while reading both files.
   *
   * @evidence contracts/common.md#principled-implementation A unique compiler source and an output below the producer's emit directory determine the pair before content is read.
   * @evidence contracts/common.md#clear-and-simple-design One publication pass handles only the JSON marker subset of the existing ledger.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing, aliased and ambiguous marker outputs acquire no proof.
   * @evidence contracts/common.md#meaningful-documentation Describes producer ownership and the stable namespace premise.
   * @evidence contracts/portability.md#os-neutral-implementation Path and regular-file observations preserve native names without inferring case identity.
   * @evidence contracts/performance.md#efficient-algorithms One ledger pass filters names before filesystem IO. Hashing costs scale with the bytes of admitted marker pairs.
   * @evidence contracts/performance.md#reuse-equivalent-work The returned proof is transported to both normal and abandoned cleanup.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Only marker coordinates and fixed-size digests are retained. File buffers and handles are local to each observation.
   */
  export function capture(
    emitDir: string,
    emittedSources: Readonly<Record<string, readonly string[]>>,
  ): Proofs | undefined {
    const proofs: Record<string, { source: string; output: string }> =
      Object.create(null);
    for (const [output, sources] of Object.entries(emittedSources)) {
      if (sources.length !== 1 || !isPathWithin(output, emitDir)) continue;
      const bytes = readPair(output, sources[0]);
      if (bytes !== undefined)
        proofs[output] = {
          source: digest(bytes.source),
          output: digest(bytes.output),
        };
    }
    return Object.keys(proofs).length === 0 ? undefined : proofs;
  }

  /**
   * Match a marker against its existing compiler ledger and current bytes.
   * Without a recorded pair, only a literal copy can be proved.
   *
   * @evidence contracts/common.md#principled-implementation Each recorded digest is checked against its own current byte sequence and the exact compiler-proved source path.
   * @evidence contracts/common.md#clear-and-simple-design One check serves run reclamation and dependency reuse, with historical literal copies handled in the same read.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing or differing digests cannot grant permission to reclaim reformatted files.
   * @evidence contracts/common.md#meaningful-documentation Defines the current verification and compatibility rule.
   * @evidence contracts/portability.md#os-neutral-implementation Current regular files and exact native coordinates establish the comparison.
   * @evidence contracts/performance.md#efficient-algorithms At most one source and output are inspected and compared, proportional to their bytes.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A change to either file can make a previous comparison stale.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Observations are call-local and retain no handles.
   */
  export function matches(
    output: string,
    sources: unknown,
    proof: unknown,
  ): boolean {
    if (!Array.isArray(sources) || sources.length !== 1) return false;
    const bytes = readPair(output, sources[0]);
    if (bytes === undefined) return false;
    if (proof === undefined) return bytes.output.equals(bytes.source);
    return (
      typeof proof === "object" &&
      proof !== null &&
      "source" in proof &&
      "output" in proof &&
      proof.source === digest(bytes.source) &&
      proof.output === digest(bytes.output)
    );
  }

  /** Read the two observed regular files without following a marker alias. */
  function readPair(output: string, source: unknown) {
    const name = path.basename(output);
    if (
      path.extname(name).toLowerCase() !== ".json" ||
      !systemTempOutsideProject.isProjectMarker(name) ||
      !path.isAbsolute(output) ||
      typeof source !== "string" ||
      !path.isAbsolute(source) ||
      !sameMarkerName(path.basename(source), name) ||
      source === output
    )
      return undefined;
    try {
      const read = (file: string) => {
        const entry = fs.lstatSync(file);
        if (
          !entry.isFile() ||
          (file === output && entry.nlink !== 1) ||
          RuntimeFilesystem.realpathWitness(file) !== file
        )
          return undefined;
        return RuntimeFilesystem.readObservedRegularFile(file, true);
      };
      const emitted = read(output);
      const original = read(source);
      return emitted === undefined || original === undefined
        ? undefined
        : { output: emitted, source: original };
    } catch {
      return undefined;
    }
  }

  /** Match the filesystem guard's native project marker policy. */
  function sameMarkerName(left: string, right: string): boolean {
    return process.platform === "win32"
      ? left.toLowerCase() === right.toLowerCase()
      : left === right;
  }

  /** Encode the exact observed bytes, independent of the compiler's serializer. */
  function digest(bytes: Buffer): string {
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }
}
