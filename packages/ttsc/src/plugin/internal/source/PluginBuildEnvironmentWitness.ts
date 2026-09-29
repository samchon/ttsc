import fs from "node:fs";

/**
 * The paths a reading of a plugin build environment depended on that no
 * variable carries, each with its metadata at the moment it was read.
 *
 * The environment digest reads the Go tool, the file `go env -w` writes, the
 * executables the C toolchain commands name, and GOROOT
 * (`hashPluginBuildEnvironment`). Their metadata, taken before their content is
 * read, is what a later observer compares: a process keeping its reading
 * (`processPluginBuildEnvironment`, samchon/ttsc#1516), and a build proving the
 * toolchain it ran is the one its key read (samchon/ttsc#1534). Change time can
 * reveal a write even when size and modification time are restored.
 *
 * This is a native metadata witness, not a second byte comparison. Its change
 * detection assumes the filesystem distinguishes contributing edits in the
 * captured identity and timestamps; an edit that reproduces the entire metadata
 * signature is outside the proof this record supplies.
 *
 * @evidence contracts/common.md#principled-implementation Pre-read identity and write metadata witness external dependencies not carried by variables under the documented metadata-distinguishability premise; a refused dependency makes the complete reading unusable.
 * @evidence contracts/common.md#clear-and-simple-design Record construction, refusal and validation share one metadata representation; the caller owns the reading and its lifetime.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Validation inspects real paths instead of replacing filesystem behavior or accepting a stable pathname as proof of unchanged contents.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain provenance, replacement detection and both consuming boundaries; member documentation states refusal and validation meaning.
 * @evidence contracts/portability.md#os-neutral-implementation Node bigint stat metadata supplies native identity and timestamps while following the same links as the content reader; no platform name supplies case or identity policy.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms This namespace defines the record and operations; add and holds own observation/validation processing.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Consumers own environment reuse; the namespace itself retains no reading.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Witness maps are created and released by callers, not retained by this namespace.
 */
export namespace PluginBuildEnvironmentWitness {
  /**
   * Each witnessed path's metadata when it was first read.
   *
   * @evidence contracts/common.md#principled-implementation A path-to-signature map preserves the first observation for each dependency so later reads cannot overwrite evidence of a race.
   * @evidence contracts/common.md#clear-and-simple-design The record carries only dependencies and their signatures; witness operations own interpretation and consumers own retention.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The representation stores observed native state rather than predeclared expected results.
   * @evidence contracts/common.md#meaningful-documentation The native description identifies first-read provenance, which is the nonobvious meaning of this otherwise ordinary map.
   * @evidence contracts/portability.md#os-neutral-implementation Keys are native path spellings supplied by readers and values contain Node native metadata, not a guessed filesystem case policy.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms The map type supplies a representation; capture and validation operations choose their algorithms.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The record does not decide whether consumers may reuse an environment reading.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Record lifetime belongs to the creating consumer; the type does not retain its own instances.
   */
  export type Record = Map<string, string>;

  /**
   * Record `file`'s metadata before reading it, unless already recorded.
   * `observed` reuses a stat the caller just took before the same read.
   *
   * @evidence contracts/common.md#principled-implementation First-write retention keeps the earliest metadata even when a path contributes more than once; caller-provided metadata is from the same pre-read observation.
   * @evidence contracts/common.md#clear-and-simple-design Optional output makes one reader usable with or without a witness and leaves signature encoding in one helper.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Observation uses native stat state; absent witnessing does not alter the content read or fake validity.
   * @evidence contracts/common.md#meaningful-documentation Native prose states first-observation semantics and the provenance required for the optional stat, with a blank line before tags.
   * @evidence contracts/portability.md#os-neutral-implementation Metadata comes from Node bigint stat for the actual path; callers can reuse precisely that native observation.
   * @evidence contracts/performance.md#efficient-algorithms Map membership is expected constant time; one metadata probe occurs only for a previously unseen dependency without an already-observed stat.
   * @evidence contracts/performance.md#reuse-equivalent-work Repeated dependencies reuse the first signature and a caller's pre-read stat avoids repeating the equivalent syscall.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns the witness map and its release; this operation adds one dependency without retaining another handle.
   */
  export function add(
    witness: Record | undefined,
    file: string,
    observed?: fs.BigIntStats,
  ): void {
    if (witness === undefined || witness.has(file)) return;
    witness.set(file, signature(file, observed));
  }

  /**
   * Record `file` as a path whose state could not be witnessed, so the record
   * never holds and nothing kept under it is reused.
   *
   * @evidence contracts/common.md#principled-implementation The refusal sentinel cannot equal a metadata signature, so an incomplete environment never passes holds.
   * @evidence contracts/common.md#clear-and-simple-design One sentinel uses the existing record format rather than adding a parallel error collection.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An unreadable dependency refuses reuse rather than substituting an assumed valid reading.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the effect on every consumer of the record, not merely the stored value.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This operation stores a sentinel and performs no native path lookup.
   * @evidenceExclude contracts/performance.md#efficient-algorithms One optional map write does not choose a workload-processing algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work It invalidates a witness rather than sharing a computation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Record lifetime belongs to the caller.
   */
  export function refuse(witness: Record | undefined, file: string): void {
    witness?.set(file, UNWITNESSABLE);
  }

  /**
   * Whether every witnessed path still has the metadata it was read with.
   *
   * @evidence contracts/common.md#principled-implementation Universal comparison requires every dependency to match its pre-read signature and immediately rejects a refused or changed path.
   * @evidence contracts/common.md#clear-and-simple-design Validation uses the same signature helper as capture, keeping identity and timestamp policy in one place.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts All dependencies are inspected; a quiet parent or unchanged VERSION cannot stand in for nested SDK inputs.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the universal unchanged-metadata condition and tags remain separated from it.
   * @evidence contracts/portability.md#os-neutral-implementation Validation reads actual Node metadata using the same link-following semantics as capture.
   * @evidence contracts/performance.md#efficient-algorithms Validation costs O(P) native stat calls for P dependencies and stops on the first mismatch; no content buffers are allocated.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call must establish current validity; caching that answer would conceal external changes.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Validation retains no handles or additional historical state.
   */
  export function holds(witness: Record): boolean {
    for (const [file, recorded] of witness)
      if (signature(file) !== recorded) return false;
    return true;
  }

  /** A recorded state no signature equals. */
  const UNWITNESSABLE = "unwitnessable";

  /**
   * The metadata a replacement moves: identity, size, and modification and
   * change times, following links; `missing` for a path that is not there.
   */
  function signature(file: string, observed?: fs.BigIntStats): string {
    try {
      const stat = observed ?? fs.statSync(file, { bigint: true });
      return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(
        ":",
      );
    } catch {
      return "missing";
    }
  }
}
