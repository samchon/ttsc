import fs from "node:fs";
import path from "node:path";

import { E2ETrace } from "../../../internal/E2ETrace";
import { RuntimeFilesystem } from "../../../launcher/internal/runtime/RuntimeFilesystem";

/**
 * Native path metadata and ambient lookup variables actually observed while
 * reading a plugin build environment.
 *
 * The environment digest reads the Go tool, the file `go env -w` writes, the
 * executables the C toolchain commands name, and GOROOT
 * (`hashPluginBuildEnvironment`). Their metadata, taken before their content is
 * read, is what a later observer compares: a process keeping its reading
 * (`processPluginBuildEnvironment`), and a build proving the toolchain it ran
 * is the one its key read. Change time can reveal a write even when size and
 * modification time are restored.
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
   * Recover the exact native path and kind of a filesystem witness key.
   *
   * @evidence contracts/common.md#principled-implementation The namespace's encoding distinguishes followed metadata, links, directory identity, and non-filesystem observations.
   * @evidence contracts/common.md#clear-and-simple-design Consumers use one decoder and retain their own observation policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Returns the original path spelling without resolving parent traversal or decoding raw bytes into a lossy string.
   * @evidence contracts/common.md#meaningful-documentation Identifies the returned native path and its observation kind.
   * @evidence contracts/portability.md#os-neutral-implementation Qualified keys preserve native path strings and opaque byte spellings.
   * @evidence contracts/performance.md#efficient-algorithms Checks fixed prefixes and slices the matched spelling.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Decoding retains no result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Allocates no native resource.
   */
  export function pathOf(
    key: string,
  ): { file: string; kind: "stat" | "link" | "directory" } | undefined {
    if (key === TOOLCHAIN_PROBE || key.startsWith(ENVIRONMENT_PREFIX))
      return undefined;
    if (key.startsWith(DIRECTORY_PREFIX))
      return { file: key.slice(DIRECTORY_PREFIX.length), kind: "directory" };
    if (key.startsWith(LINK_PREFIX))
      return { file: key.slice(LINK_PREFIX.length), kind: "link" };
    return { file: key, kind: "stat" };
  }

  /**
   * Group native observations by usable watch spelling. Raw paths retain their
   * exact keys and use their nearest UTF-8 ancestor for notification delivery.
   * A POSIX path with parent traversal must first resolve natively, and keeps
   * polling its original spelling so an alias retarget remains observable.
   *
   * @evidence contracts/common.md#principled-implementation Replays the original metadata keys, including raw path bytes, and assigns a representable watch anchor.
   * @evidence contracts/common.md#clear-and-simple-design The owner of key encoding also translates it to watch registrations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Only the registration path is translated; literal raw path keys remain intact.
   * @evidence contracts/common.md#meaningful-documentation Specifies the reason for assigning a raw input an ancestor watch.
   * @evidence contracts/portability.md#os-neutral-implementation Raw POSIX components are shortened before UTF-8 decoding. POSIX parent traversal resolves through the native filesystem before selecting an anchor.
   * @evidence contracts/performance.md#efficient-algorithms Visits each witness entry. Raw decoding can visit its ancestors, and a POSIX parent traversal can require native realpath across its existing ancestry. No payload bytes are read.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Groups belong to the current load.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The result borrows witness strings and holds no handle.
   */
  export function watchInputs(
    witnesses: readonly Record[],
    projectRoot: string,
  ): {
    [anchor: string]: {
      entries: [string, string][];
      recursive?: true;
      poll?: true;
    };
  } {
    const groups = new Map<
      string,
      { entries: [string, string][]; recursive?: true; poll?: true }
    >();
    for (const witness of witnesses)
      for (const [key, signature] of witness) {
        if (key === TOOLCHAIN_PROBE) continue;
        const file = pathOf(key)?.file ?? projectRoot;
        const traverses =
          process.platform !== "win32" &&
          path.isAbsolute(file) &&
          /(?:^|\/)\.\.(?:\/|$)/.test(file);
        const location = traverses ? nativeWatchLocation(file) : file;
        let raw = RuntimeFilesystem.rawRealpath(location);
        const recursive = raw !== undefined;
        let anchor = projectRoot;
        if (raw !== undefined) {
          while (raw.length !== 0) {
            const spelling = raw.toString();
            if (Buffer.from(spelling).equals(raw)) {
              anchor = spelling;
              break;
            }
            const separator = raw.lastIndexOf(47);
            if (separator <= 0) {
              anchor = "/";
              break;
            }
            raw = raw.subarray(0, separator);
          }
        } else if (path.isAbsolute(location)) {
          anchor = path.resolve(location);
        }
        const group: {
          entries: [string, string][];
          recursive?: true;
          poll?: true;
        } = groups.get(anchor) ?? { entries: [] };
        group.entries.push([key, signature]);
        if (recursive) group.recursive = true;
        if (traverses) group.poll = true;
        groups.set(anchor, group);
      }
    return Object.fromEntries(groups);
  }

  /** Recover a native anchor while keeping the original lookup in the witness. */
  function nativeWatchLocation(file: string): string {
    for (let location = file; ; location = path.dirname(location)) {
      try {
        return RuntimeFilesystem.realpathWitness(location);
      } catch {
        if (location === "/") return location;
      }
    }
  }

  /**
   * Each witnessed path's metadata when it was first read. Link observations
   * use qualified internal keys so link spelling and followed target state
   * remain separate dependencies.
   *
   * @evidence contracts/common.md#principled-implementation Capture operations preserve first observations in this map, with explicit refusal replacing a value by an unusable sentinel. The mutable Map type itself does not prevent arbitrary caller overwrites or validate provenance.
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
   * `observed` reuses a stat the caller just took before the same read, or null
   * when that native stat failed.
   *
   * @evidence contracts/common.md#principled-implementation First-write retention keeps the earliest metadata even when a path contributes more than once; caller-provided metadata is from the same pre-read observation.
   * @evidence contracts/common.md#clear-and-simple-design Optional output makes one reader usable with or without a witness and leaves signature encoding in one helper.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Observation uses native stat state; absent witnessing does not alter the content read or fake validity.
   * @evidence contracts/common.md#meaningful-documentation Native prose states first-observation semantics and the provenance required for the optional stat, with a blank line before tags.
   * @evidence contracts/portability.md#os-neutral-implementation Metadata comes from Node bigint stat for the actual path; callers can reuse precisely that native observation.
   * @evidence contracts/performance.md#efficient-algorithms Map membership/set processes path keys; an unseen dependency without supplied metadata performs native stat/path lookup, then formats bigint fields. Native/key/numeric-text costs remain despite expected constant-time map indexing; supplied stat provenance is a caller premise.
   * @evidence contracts/performance.md#reuse-equivalent-work Repeated dependencies reuse the first signature and a caller's pre-read stat avoids repeating the equivalent syscall.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns the witness map and its release; this operation adds one dependency without retaining another handle.
   */
  export function add(
    witness: Record | undefined,
    file: string,
    observed?: fs.BigIntStats | null,
  ): void {
    if (witness === undefined || witness.has(file)) return;
    witness.set(file, signature(file, observed));
  }

  /**
   * Record a directory's current target without treating changes to unrelated
   * children as a new working directory.
   *
   * @evidence contracts/common.md#principled-implementation Physical spelling and native device, inode and access-related metadata qualify the directory used for Go lookup.
   * @evidence contracts/common.md#clear-and-simple-design A separate key distinguishes directory identity from a file or link signature.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Directory content changes have their own witnesses. Full directory timestamps would refuse otherwise equivalent lookups.
   * @evidence contracts/common.md#meaningful-documentation The prose states which changes this witness leaves to other inputs.
   * @evidence contracts/portability.md#os-neutral-implementation Native stat and realpath follow directory aliases across supported platforms, with a common unavailable marker.
   * @evidence contracts/performance.md#efficient-algorithms One unseen key needs metadata and physical spelling unless the caller already observed them. No contents are read.
   * @evidence contracts/performance.md#reuse-equivalent-work The first observation for the directory survives repeats in one caller-owned record.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The witness owner retains the serialized identity and no native handles are acquired.
   */
  export function addDirectoryIdentity(
    witness: Record,
    directory: string,
    observed?: fs.BigIntStats,
    physical?: string,
  ): void {
    const key = DIRECTORY_PREFIX + directory;
    if (!witness.has(key))
      witness.set(key, directorySignature(directory, observed, physical));
  }

  /**
   * Witness a link itself before following it, including a missing target.
   * Target metadata remains a separate observation through add.
   *
   * @evidence contracts/common.md#principled-implementation First-observation retention records native link metadata and target spelling separately from followed-target state. A successfully observed changed spelling changes this witness; unavailable lstat/readlink yields the helper's missing marker, which does not distinguish every failure cause.
   * @evidence contracts/common.md#clear-and-simple-design Qualified keys keep link and target observations in the same caller-owned record, and holds dispatches to their respective native observations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A link's existence does not certify its target; native lstat and readlink preserve missing-target and retargeting distinctions without replacing filesystem operations.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes the link observation from add's target observation and states pre-follow timing.
   * @evidence contracts/portability.md#os-neutral-implementation Node lstat and readlink inspect the native link or junction and its target spelling without an OS-based case or existence assumption.
   * @evidence contracts/performance.md#efficient-algorithms Qualified-key construction/map indexing process path text; an unseen link uses native lstat/readlink and serializes bigint/target spelling. Native component/link lookup and all numeric/path/target bytes contribute work; no file content is read.
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
   * A different repeated observation refuses the reading. A captured transient
   * value can reveal an ABA interval hidden by initial/final snapshots; a value
   * never observed here is not detected by this record.
   *
   * @evidence contracts/common.md#principled-implementation First observed native lookup inputs remain paired with the digest and are compared with current host inputs before publication and reuse.
   * @evidence contracts/common.md#clear-and-simple-design Disjoint environment keys share the existing caller-owned witness and validation boundary.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual observed variables qualify native selection without writing the parent's shared environment or inventing a tool identity.
   * @evidence contracts/common.md#meaningful-documentation The prose distinguishes lookup-time authority from request and final snapshots.
   * @evidence contracts/portability.md#os-neutral-implementation Native executable selection supplies the variable value it observed; holds uses lowercase-name matching on Windows and direct name lookup elsewhere, without writing host variables.
   * @evidence contracts/performance.md#efficient-algorithms Name qualification/map indexing and JSON serialization process supplied name/value bytes on every observation, including repeats. Equal observations keep the first value; a different value sets the refusal sentinel, with no native subprocess or file-content read here.
   * @evidence contracts/performance.md#reuse-equivalent-work Repeated equal observations reuse the first signature; a different observation refuses the complete reading.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns and releases the record; this operation retains no process or environment handle.
   */
  export function addEnvironment(
    witness: Record | undefined,
    name: string,
    value: string | undefined,
  ): void {
    if (witness === undefined) return;
    const key = ENVIRONMENT_PREFIX + name;
    const recorded = JSON.stringify([value ?? null]);
    if (witness.has(key) && witness.get(key) !== recorded)
      witness.set(key, UNWITNESSABLE);
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
   * @evidence contracts/performance.md#efficient-algorithms An optional supplied-map write processes the key and replaces its value with a fixed sentinel; it performs no native observation, content scan or separate dependency traversal.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work It invalidates a witness rather than sharing a computation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Record lifetime belongs to the caller.
   */
  export function refuse(witness: Record | undefined, file: string): void {
    witness?.set(file, UNWITNESSABLE);
  }

  /**
   * Retain the dependencies of a nested reading. If two observations of an
   * input disagree, their combined reading has no proof for that input. A
   * refusal stays in force across subsequent reads.
   *
   * @evidence contracts/common.md#principled-implementation New observations extend the caller's proof. Conflicting or refused observations leave proof of the combined reading unavailable.
   * @evidence contracts/common.md#clear-and-simple-design The witness owner interprets the refusal sentinel when composing readings.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An earlier positive stat cannot hide a nested refusal, and a later positive stat cannot recover it.
   * @evidence contracts/common.md#meaningful-documentation Describes how repeated observations and explicit refusal affect combined proof.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Map keys retain their supplied spelling without a new lookup.
   * @evidence contracts/performance.md#efficient-algorithms A single pass over the nested rows probes the existing observations without native I/O.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The caller already owns both observations.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The target keeps one signature per key. No handle or additional collection is retained.
   */
  export function join(target: Record | undefined, source: Record): void {
    if (target === undefined) return;
    for (const [key, observed] of source) {
      const previous = target.get(key);
      if (previous === undefined) target.set(key, observed);
      else if (previous !== observed) refuse(target, key);
    }
  }

  /**
   * Require Go to select the toolchain again before this reading can be reused.
   * The current build can still validate the paths it actually observed.
   *
   * @evidence contracts/common.md#principled-implementation Marks unproved delegated toolchain selection separately from a changed input in the current build.
   * @evidence contracts/common.md#clear-and-simple-design The marker follows the same witness through worker transfer and composed readings.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not treat the observed SDK as proof of future Go dispatch.
   * @evidence contracts/common.md#meaningful-documentation Distinguishes observation validation from permission to reuse.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Writes a private map key and performs no native observation.
   * @evidence contracts/performance.md#efficient-algorithms Adds one fixed map entry.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Withdraws historical reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns the witness map.
   */
  export function requireToolchainProbe(witness: Record | undefined): void {
    witness?.set(TOOLCHAIN_PROBE, "");
  }

  /**
   * Check dispatch eligibility without repeating native witness validation. The
   * caller still checks whether the recorded inputs hold.
   *
   * @evidence contracts/common.md#principled-implementation A recorded probe requirement excludes dispatch reuse independently of whether the observed paths still hold.
   * @evidence contracts/common.md#clear-and-simple-design The witness owns interpretation of its private dispatch marker.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Absence of the marker does not substitute for the caller's validity check.
   * @evidence contracts/common.md#meaningful-documentation Distinguishes dispatch eligibility from current native validation.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This reads one private map key without native lookup.
   * @evidence contracts/performance.md#efficient-algorithms One map lookup avoids repeating a validation already performed by the caller.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The predicate does not retain a validity verdict.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns the witness.
   */
  export function hasToolchainProof(witness: Record): boolean {
    return !witness.has(TOOLCHAIN_PROBE);
  }

  /**
   * Whether a recorded answer can replace a fresh native reading.
   *
   * @evidence contracts/common.md#principled-implementation Requires proved dispatch as well as unchanged path and environment observations.
   * @evidence contracts/common.md#clear-and-simple-design Stored answers and process-local lookups share the same boundary.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No witness with unproved selection returns a cache hit.
   * @evidence contracts/common.md#meaningful-documentation States when a record can replace a native reading.
   * @evidence contracts/portability.md#os-neutral-implementation Native path and environment observations stay with holds.
   * @evidence contracts/performance.md#efficient-algorithms One map check rejects delegated readings before a validation walk.
   * @evidence contracts/performance.md#reuse-equivalent-work Qualified readings share the caller's synchronous observations through holds.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains no witness or results.
   */
  export function reusable(
    witness: Record,
    currentReadings?: Map<string, string>,
  ): boolean {
    return (
      hasToolchainProof(witness) && holds(witness, undefined, currentReadings)
    );
  }

  /**
   * Check whether a prior reading covers every newly observed launcher input.
   * Callers still validate the rest of the prior evidence at admission.
   *
   * @evidence contracts/common.md#principled-implementation Every current selection observation must exist in the prior reading with the same signature, and an unproved prior dispatch cannot qualify.
   * @evidence contracts/common.md#clear-and-simple-design Captured observations compare directly before composing answers, separately from filesystem validation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A missing or contradictory observation declines shared authority.
   * @evidence contracts/common.md#meaningful-documentation The contract states the coverage rule and responsibility for later validation.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This compares previously captured strings and does not access the filesystem.
   * @evidence contracts/performance.md#efficient-algorithms Iterates the current selection observations with one lookup each, without restatting the SDK.
   * @evidence contracts/performance.md#reuse-equivalent-work Matching launcher inputs let callers reuse a prior digest after remaining validation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The comparison owns no retained state or handles.
   */
  export function covers(prior: Record, current: Record): boolean {
    if (!hasToolchainProof(prior)) return false;
    for (const [key, signature] of current)
      if (prior.get(key) !== signature) return false;
    return true;
  }

  /**
   * Whether every native path and ambient variable still matches its
   * observation. The existing private opt-in trace retains the first actual
   * mismatch without repeating its lookup or changing the refusal. An optional
   * observation label separates preparation and build epochs in that trace; it
   * does not change validation or authorize publication. A supplied native
   * observation map belongs to one synchronous batch only; never reuse it after
   * an await, delivery, environment mutation or publication boundary.
   *
   * @evidence contracts/common.md#principled-implementation Universal comparison requires every dependency to match its pre-read signature and immediately rejects a refused or changed path.
   * @evidence contracts/common.md#clear-and-simple-design Validation uses the same signature helper as capture, keeping identity and timestamp policy in one place.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Every recorded dependency is inspected. Mutable SDK inputs are recorded individually; the packaged SDK reader explicitly relies on the installed package's versioned contents.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the universal unchanged-metadata condition and tags remain separated from it.
   * @evidence contracts/portability.md#os-neutral-implementation Validation reads actual Node metadata using the same link-following semantics as capture.
   * @evidence contracts/performance.md#efficient-algorithms Validation iterates dependencies until mismatch and performs native stat/link queries or ambient-variable serialization. Windows environment matching enumerates names and lowercases text per witnessed variable, so P alone does not bound that work. Native path/link/name/value/numeric bytes contribute cost; file content is not read and unavailable native observations share the helper's missing marker. An enabled private trace serializes the first mismatch's already-computed text through its existing bounded sink.
   *
   * @evidence contracts/performance.md#reuse-equivalent-work A caller-owned synchronous batch may share current native observations, comparing each witness against its own expected state; ordinary calls and all later observation phases establish new validity.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Validation retains no handles or additional historical state.
   */
  export function holds(
    witness: Iterable<readonly [string, string]>,
    observation?: string,
    currentReadings?: Map<string, string>,
  ): boolean {
    for (const [file, recorded] of witness) {
      if (file === TOOLCHAIN_PROBE) continue;
      let current = currentReadings?.get(file);
      if (current === undefined) {
        current = currentSignature(file);
        currentReadings?.set(file, current);
      }
      if (current !== recorded) {
        E2ETrace.capabilityResolution(
          "plugin-build-environment-witness-mismatch",
          {
            key: file,
            recorded,
            current,
            refused: recorded === UNWITNESSABLE,
            observation,
          },
        );
        return false;
      }
    }
    return true;
  }

  /**
   * Distinguish a moved native observation from a refused or unproved read. A
   * refusal still cannot authorize reuse.
   *
   * @evidence contracts/common.md#principled-implementation A changed previously observed signature signals drift. Probe and refusal markers do not claim a native state.
   * @evidence contracts/common.md#clear-and-simple-design Reuses the validation owner's current native signatures.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An unchanged result here does not qualify a witness for reuse.
   * @evidence contracts/common.md#meaningful-documentation Distinguishes evidence movement from missing authority.
   * @evidence contracts/portability.md#os-neutral-implementation Current signatures use the same native metadata and environment semantics as capture.
   * @evidence contracts/performance.md#efficient-algorithms Visits comparable keys up to the first mismatch without retaining a second map.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call observes the current native inputs.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains no observations or handles.
   */
  export function hasChanged(witness: Record): boolean {
    for (const [key, recorded] of witness)
      if (
        key !== TOOLCHAIN_PROBE &&
        recorded !== UNWITNESSABLE &&
        currentSignature(key) !== recorded
      )
        return true;
    return false;
  }

  /**
   * Observe the exact native keys of a failed workspace for retry comparison.
   *
   * @evidence contracts/common.md#principled-implementation Current signatures are captured with the same key interpretation as validation, even after the original observation moved.
   * @evidence contracts/common.md#clear-and-simple-design This shares native signature decoding with holds.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The result gives only a retry baseline and supplies no proof of the original build or toolchain dispatch.
   * @evidence contracts/common.md#meaningful-documentation The comment identifies the exact keys and the retry owner.
   * @evidence contracts/portability.md#os-neutral-implementation The signature reader preserves raw native paths, link identity and environment naming rules.
   * @evidence contracts/performance.md#efficient-algorithms Each supplied key costs a native metadata observation or environment lookup and one retained text pair.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A new terminal verdict requires current observations.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns the returned entries. No native handle is retained.
   */
  export function retryBaseline(
    entries: Iterable<readonly [string, string]>,
    changed?: (key: string) => void,
  ): [string, string][] {
    const baseline: [string, string][] = [];
    for (const [key, previous] of entries) {
      if (key === TOOLCHAIN_PROBE) continue;
      const current = currentSignature(key);
      baseline.push([key, current]);
      if (previous !== UNWITNESSABLE && previous !== current) changed?.(key);
    }
    return baseline;
  }

  /**
   * Keep the latest actual native reading for recovery. If only a refusal is
   * available, retain its key for baseline sampling without claiming movement.
   *
   * @evidence contracts/common.md#principled-implementation Native observations replace earlier facts while a later refusal cannot erase the last state observed.
   * @evidence contracts/common.md#clear-and-simple-design Witness encoding and refusal handling stay with their owner.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Recovery acquisition grants neither reusable output nor proof that a refusal means a changed path.
   * @evidence contracts/common.md#meaningful-documentation Describes which state and keys survive into retry comparison.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The operation copies captured witness strings and performs no native I/O.
   * @evidence contracts/performance.md#efficient-algorithms Iterates the incoming keys once, retaining at most one state per native observation key.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Merging observations does not authorize cached answers.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns the retained witness map.
   */
  export function retainForRecovery(target: Record, observed: Record): void {
    for (const [key, signature] of observed)
      if (
        pathOf(key) !== undefined &&
        (signature !== UNWITNESSABLE || !target.has(key))
      )
        target.set(key, signature);
  }

  function currentSignature(file: string): string {
    if (file.startsWith(ENVIRONMENT_PREFIX))
      return environmentSignature(file.slice(ENVIRONMENT_PREFIX.length));
    if (file.startsWith(LINK_PREFIX))
      return linkSignature(file.slice(LINK_PREFIX.length));
    if (file.startsWith(DIRECTORY_PREFIX))
      return directorySignature(file.slice(DIRECTORY_PREFIX.length));
    return signature(file);
  }

  /** A recorded state no signature equals. */
  const UNWITNESSABLE = "unwitnessable";
  /** NUL cannot occur in a native pathname, so this qualification is disjoint. */
  const LINK_PREFIX = "\0link:";
  const DIRECTORY_PREFIX = "\0directory:";
  const ENVIRONMENT_PREFIX = "\0environment:";
  const TOOLCHAIN_PROBE = "\0requires-toolchain-probe";

  function environmentSignature(name: string): string {
    const actualName =
      process.platform === "win32"
        ? Object.keys(process.env).find(
            (key) => key.toLowerCase() === name.toLowerCase(),
          )
        : name;
    return JSON.stringify([
      actualName === undefined ? null : (process.env[actualName] ?? null),
    ]);
  }

  /** Observe the link before its target, under the same metadata premise. */
  function linkSignature(file: string): string {
    try {
      const native = RuntimeFilesystem.rawRealpath(file) ?? file;
      const stat = fs.lstatSync(native, { bigint: true });
      return JSON.stringify([
        stat.dev.toString(),
        stat.ino.toString(),
        stat.size.toString(),
        stat.mtimeNs.toString(),
        stat.ctimeNs.toString(),
        process.platform === "win32"
          ? fs.readlinkSync(native)
          : posixLinkTarget(native),
      ]);
    } catch {
      return "missing";
    }
  }

  /** Preserve native link bytes without changing valid UTF-8 signatures. */
  function posixLinkTarget(file: string | Buffer): string | [string, string] {
    const target = fs.readlinkSync(file, { encoding: "buffer" });
    const spelling = target.toString();
    return Buffer.from(spelling).equals(target)
      ? spelling
      : ["bytes", target.toString("base64url")];
  }

  function directorySignature(
    directory: string,
    observed?: fs.BigIntStats,
    physical?: string,
  ): string {
    try {
      const native = RuntimeFilesystem.rawRealpath(directory) ?? directory;
      const stat = observed ?? fs.statSync(native, { bigint: true });
      if (!stat.isDirectory()) return "missing";
      return JSON.stringify([
        physical ?? RuntimeFilesystem.realpathWitness(native),
        stat.dev.toString(),
        stat.ino.toString(),
        stat.mode.toString(),
        stat.uid.toString(),
        stat.gid.toString(),
      ]);
    } catch {
      return "missing";
    }
  }

  /**
   * The metadata a replacement moves: identity, mode, size, and modification
   * and change times, following links; `missing` when the native stat is
   * unavailable.
   */
  function signature(file: string, observed?: fs.BigIntStats | null): string {
    if (observed === null) return "missing";
    try {
      const stat =
        observed ??
        fs.statSync(RuntimeFilesystem.rawRealpath(file) ?? file, {
          bigint: true,
        });
      return [
        stat.dev,
        stat.ino,
        stat.mode,
        stat.size,
        stat.mtimeNs,
        stat.ctimeNs,
      ].join(":");
    } catch {
      return "missing";
    }
  }
}
