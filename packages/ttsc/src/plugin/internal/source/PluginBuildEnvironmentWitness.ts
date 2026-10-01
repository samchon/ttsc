import fs from "node:fs";

/**
 * Native path metadata and ambient lookup variables actually observed while
 * reading a plugin build environment.
 *
 * The environment digest reads the Go tool, the file `go env -w` writes, the
 * executables the C toolchain commands name, and GOROOT
 * (`hashPluginBuildEnvironment`). Their metadata, taken before their content is
 * read, is what a later observer compares: a process keeping its reading
 * (`processPluginBuildEnvironment`, samchon/ttsc#1516), and a build proving the
 * toolchain it ran is the one its key read (samchon/ttsc#1534). Change time can
 * reveal a write even when size and modification time are restored.
 *
 * This witnesses native metadata and link target names, not a second byte
 * comparison. Its change detection assumes the filesystem distinguishes
 * contributing edits in the captured identity and timestamps; an edit that
 * reproduces the entire metadata signature is outside the proof this record
 * supplies. Native executable lookup variables are recorded at the lookup,
 * because a shared worker can observe a transient parent value between the
 * request and final snapshots.
 *
 * @evidence contracts/common.md#principled-implementation Pre-read identity and write metadata witness external dependencies not carried by variables under the documented metadata-distinguishability premise; a refused dependency makes the complete reading unusable.
 * @evidence contracts/common.md#clear-and-simple-design Record construction, refusal and validation share one metadata representation; the caller owns the reading and its lifetime.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Validation inspects real paths instead of replacing filesystem behavior or accepting a stable pathname as proof of unchanged contents.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain provenance, replacement detection and both consuming boundaries; member documentation states refusal and validation meaning.
 * @evidence contracts/portability.md#os-neutral-implementation Node bigint stat follows the content reader's targets, while lstat and readlink separately witness link identity and target spelling; no platform name supplies case or identity policy.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms This namespace defines the record and operations; add and holds own observation/validation processing.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Consumers own environment reuse; the namespace itself retains no reading.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Witness maps are created and released by callers, not retained by this namespace.
 */
export namespace PluginBuildEnvironmentWitness {
  /**
   * Each witnessed path's metadata when it was first read. Link observations
   * use qualified internal keys so link spelling and followed target state
   * remain separate dependencies.
   *
   * @evidence contracts/common.md#principled-implementation A path-to-signature map preserves the first observation for each dependency so later reads cannot overwrite evidence of a race.
   * @evidence contracts/common.md#clear-and-simple-design The record carries only dependencies and their signatures; witness operations own interpretation and consumers own retention.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The representation stores observed native state rather than predeclared expected results.
   * @evidence contracts/common.md#meaningful-documentation The native description identifies first-read provenance, which is the nonobvious meaning of this otherwise ordinary map.
   * @evidence contracts/portability.md#os-neutral-implementation Keys preserve readers' native path spellings with disjoint internal link qualifiers; values contain Node metadata and observed target spelling, not a guessed filesystem case policy.
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
   * Witness a link itself before following it, including a missing target.
   * Target metadata remains a separate observation through add.
   *
   * @evidence contracts/common.md#principled-implementation First-observation retention records native link identity and target spelling separately from followed-target metadata; retargeting a stable missing link cannot preserve this witness.
   * @evidence contracts/common.md#clear-and-simple-design Qualified keys keep link and target observations in the same caller-owned record, and holds dispatches to their respective native observations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A link's existence does not certify its target; native lstat and readlink preserve missing-target and retargeting distinctions without replacing filesystem operations.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes the link observation from add's target observation and states pre-follow timing.
   * @evidence contracts/portability.md#os-neutral-implementation Node lstat and readlink inspect the native link or junction and its target spelling without an OS-based case or existence assumption.
   * @evidence contracts/performance.md#efficient-algorithms One unseen link performs a metadata probe and a target-name read; framing costs scale with the target spelling.
   * @evidence contracts/performance.md#reuse-equivalent-work Repeated link observations retain their first signature in this record rather than replacing evidence of a race.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns the record; the operation retains no native handle.
   */
  export function addLink(witness: Record | undefined, file: string): void {
    const key = LINK_PREFIX + file;
    if (witness === undefined || witness.has(key)) return;
    witness.set(key, linkSignature(file));
  }

  /**
   * Retain an ambient native lookup variable at the exact lookup that used it.
   * A different repeated observation refuses the reading, including an ABA
   * interval that the request's initial and final snapshots cannot reveal.
   *
   * @evidence contracts/common.md#principled-implementation First observed native lookup inputs remain paired with the digest and are compared with current host inputs before publication and reuse.
   * @evidence contracts/common.md#clear-and-simple-design Disjoint environment keys share the existing caller-owned witness and validation boundary.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual observed variables qualify native selection without writing the parent's shared environment or inventing a tool identity.
   * @evidence contracts/common.md#meaningful-documentation The prose distinguishes lookup-time authority from request and final snapshots.
   * @evidence contracts/portability.md#os-neutral-implementation Native executable selection supplies the exact variable it used; holds compares host environment names with Windows case-insensitive lookup semantics.
   * @evidence contracts/performance.md#efficient-algorithms A map lookup and one serialized optional string capture each distinct native lookup variable.
   * @evidence contracts/performance.md#reuse-equivalent-work Repeated equal observations reuse the first signature; a different observation refuses the complete reading.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns and releases the record; this operation retains no process or environment handle.
   */
  export function addEnvironment(witness: Record | undefined, name: string, value: string | undefined): void {
    if (witness === undefined) return;
    const key = ENVIRONMENT_PREFIX + name;
    const recorded = JSON.stringify([value ?? null]);
    if (witness.has(key) && witness.get(key) !== recorded) witness.set(key, UNWITNESSABLE);
    else if (!witness.has(key)) witness.set(key, recorded);
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
   * Whether every native path and ambient variable still matches its observation.
   *
   * @evidence contracts/common.md#principled-implementation Universal comparison requires every dependency to match its pre-read signature and immediately rejects a refused or changed path.
   * @evidence contracts/common.md#clear-and-simple-design Validation uses the same signature helper as capture, keeping identity and timestamp policy in one place.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts All dependencies are inspected; a quiet parent or unchanged VERSION cannot stand in for nested SDK inputs.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the universal unchanged-metadata condition and tags remain separated from it.
   * @evidence contracts/portability.md#os-neutral-implementation Validation reads actual Node metadata using the same link-following semantics as capture.
   * @evidence contracts/performance.md#efficient-algorithms Validation performs O(P) path or environment observations probes for P dependencies, additionally reading each witnessed link's target spelling, and stops on the first mismatch; file contents are not read.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call must establish current validity; caching that answer would conceal external changes.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Validation retains no handles or additional historical state.
   */
  export function holds(witness: Record): boolean {
    for (const [file, recorded] of witness)
      if (
        (file.startsWith(ENVIRONMENT_PREFIX)
          ? environmentSignature(file.slice(ENVIRONMENT_PREFIX.length))
          : file.startsWith(LINK_PREFIX)
          ? linkSignature(file.slice(LINK_PREFIX.length))
          : signature(file)) !== recorded
      )
        return false;
    return true;
  }

  /** A recorded state no signature equals. */
  const UNWITNESSABLE = "unwitnessable";
  /** NUL cannot occur in a native pathname, so this qualification is disjoint. */
  const LINK_PREFIX = "\0link:";
  const ENVIRONMENT_PREFIX = "\0environment:";

  function environmentSignature(name: string): string {
    const actualName = process.platform === "win32"
      ? Object.keys(process.env).find((key) => key.toLowerCase() === name.toLowerCase())
      : name;
    return JSON.stringify([actualName === undefined ? null : process.env[actualName] ?? null]);
  }

  /** Observe the link before its target, under the same metadata premise. */
  function linkSignature(file: string): string {
    try {
      const stat = fs.lstatSync(file, { bigint: true });
      return JSON.stringify([
        stat.dev.toString(),
        stat.ino.toString(),
        stat.size.toString(),
        stat.mtimeNs.toString(),
        stat.ctimeNs.toString(),
        fs.readlinkSync(file),
      ]);
    } catch {
      return "missing";
    }
  }

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
