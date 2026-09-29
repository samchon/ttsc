import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { runtimeExecutableIdentity } from "../../../internal/runtimeExecutableIdentity";
import { SourceBuildCacheLayout } from "../source/SourceBuildCacheLayout";
import { recordCacheFileUse } from "../source/recordCacheFileUse";
import { resolveSourceBuildCachePaths } from "../source/resolveSourceBuildCachePaths";
import { declaresHostInputReads } from "./declaresHostInputReads";
import { hashHostInputPaths } from "./hashHostInputPaths";
import { realpathHostInputPaths } from "./realpathHostInputPaths";

/**
 * The persistent answers of isolated CommonJS descriptor evaluations, each
 * recorded with the state it was computed from (samchon/ttsc#1497).
 *
 * Evaluating a descriptor spawns a runtime that loads the descriptor graph in a
 * fresh module cache: seconds per launch on Windows, repeated by every `ttsc`
 * and `ttsx` launch of an unchanged project. The evaluation already proves what
 * it read, each module the graph loaded and each candidate it probed, with the
 * content and physical path it saw during the evaluation. An answer is kept
 * under everything else the evaluation was given: the descriptor, its factory
 * context, the effective environment it ran under, the runtimes that ran it,
 * and this ttsc build. It is handed out only while every input it read still
 * has the state it was read in.
 *
 * The files a descriptor reads outside its module graph are its own to declare
 * (`hostInputHashes`), and no runtime ttsc supports can observe one it leaves
 * out, so only the answer of a descriptor that declares them is recorded
 * (`declaresHostInputReads`, samchon/ttsc#1561); a declared fingerprint is
 * proven like a module the graph loaded. An evaluation that could not prove an
 * input is not recorded, and neither is one that printed anything, since a hit
 * replays nothing. Startup preloads run before these observations and cannot
 * authorize persistence merely through a stable NODE_OPTIONS string.
 *
 * @evidence contracts/common.md#principled-implementation Persistent evaluation identity includes descriptor/context, effective environment, actual primary/secondary executable content identities and ttsc version; accepted entries must prove observed module/candidate/external inputs, and unobserved startup preload authority refuses persistence.
 * @evidence contracts/common.md#clear-and-simple-design Locate/read/write separate key construction, proof validation and publication while the loader owns evaluation and its diagnostics.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A descriptor without declared external reads is not persisted, and printed evaluations are excluded by the caller because a cache hit cannot replay their effects.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains isolation cost, input-proof responsibility, environment identity and write refusal in distinct paragraphs; exported operation comments and tag spacing follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native executable identity and same-directory publication handle OS-neutral paths; sorted environment data and actual content/lexical/physical observations detect replacement without OS-name guesses.
 * @evidence contracts/performance.md#efficient-algorithms One canonical environment sort builds the identity; read/write traverse input records and only current input content is hashed, avoiding a fresh runtime/module graph load on valid hits.
 * @evidence contracts/performance.md#reuse-equivalent-work Entries share only fully keyed evaluations whose declared inputs still match; incomplete or contradictory fingerprints refuse persistence rather than reviving an unproved answer.
 * @evidence contracts/performance.md#bound-retention-and-release-resources JSON entries belong to default single-file cache pruning and hits record their use; explicit roots remain caller-owned. Staging files are locally owned and removed on write/rename failure, with crashed leftovers later eligible for pruning.
 */
export namespace PluginDescriptorEvaluationCache {
  /**
   * One evaluation's answer and the state it was computed from.
   *
   * @evidence contracts/common.md#principled-implementation Unknown descriptor data remains untrusted until the loader validates it; input hashes and physical paths preserve the evaluation's own observations rather than later filesystem readings.
   * @evidence contracts/common.md#clear-and-simple-design One serializable payload transfers the evaluation result and its input proof together without retaining the child's module cache.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The record does not assume a descriptor shape or promote absent proof to a valid cached answer.
   * @evidence contracts/common.md#meaningful-documentation Native member comments identify unvalidated answer, observed content/identity and input population; member and tag spacing follow the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Input keys and realpaths are separate native identities supplied by the evaluator; the data shape imposes neither slash-only spelling nor blanket case folding.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms This payload type performs no computation; cache operations own the hashing and collection algorithms.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The representation records evidence but establishes no reuse identity by itself; locate/read/write own acceptance.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources These fields contain serialized data, not child handles or a retained cache population; the cache namespace owns entry lifetime.
   */
  export interface IEvaluation {
    /** Serialized factory answer, validated by the plugin loader. */
    descriptor: unknown;

    /** Content observations captured during evaluation, including null. */
    hostInputHashes: Record<string, string | null>;

    /** Physical-path observations captured alongside the input reads. */
    hostInputRealpaths: Record<string, string | null>;

    /** Module and resolution-candidate inputs that the evaluator observed. */
    inputs: string[];

    /**
     * Whether the owning runtime finished recording every observation without
     * failure.
     */
    observationsComplete: boolean;
  }

  /**
   * Where the answer for one evaluation lives, or `null` when no cache root can
   * be resolved, either runtime cannot be identified, or startup preloads are
   * unobserved.
   *
   * @param props.projectRoot The project whose cache root holds the entry.
   * @param props.cacheDir The plugin cache directory the caller selected.
   * @param props.request The resolved descriptor module.
   * @param props.context The factory context the descriptor is invoked with.
   * @param props.env The complete environment the evaluation runs under.
   * @param props.runtime The runtime executable that evaluates it.
   * @param props.additionalRuntime Selected Node executable exposed to the
   *   descriptor and used by ttsx/config loaders, when distinct from runtime.
   * @param props.version This ttsc build's version.
   * @evidence contracts/common.md#principled-implementation Canonical identity includes factory context, sorted effective environment and fresh content/lexical/physical proof of both actual runtime authorities; unobserved startup preloads and unreadable runtimes cannot select a reusable entry.
   * @evidence contracts/common.md#clear-and-simple-design The locator delegates cache-root policy and runtime observation, then constructs only the descriptor entry identity.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unidentifiable runtime/storage returns null for uncached evaluation rather than weakening the key or selecting a fixture-specific runtime.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc identifies every key premise and null result; parameter entries and separate tags follow the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native realpath/stat and path.resolve/join preserve executable and cache paths; environment ordering is lexical map data, not shell syntax.
   * @evidence contracts/performance.md#efficient-algorithms Identity costs O(e log e) for environment ordering plus O(B) runtime-byte hashing in fixed-buffer space; identical primary/secondary spelling shares one executable proof, and descriptor sources are not traversed here.
   * @evidence contracts/performance.md#reuse-equivalent-work The key shares only evaluations with identical descriptor/context/environment/runtime/version authorities; observed source state is separately checked by read.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The locator retains no handle or entry population; the shared executable-proof owner closes its transient descriptor before returning, and persistence/pruning own stored entry lifetime.
   */
  export function locate(props: {
    /** Additional actual Node authority used by the descriptor host. */
    additionalRuntime?: string;

    /** Explicit caller-owned cache root, or default workspace policy. */
    cacheDir: string | undefined;

    /** Complete JSON-serializable factory context passed to evaluation. */
    context: unknown;

    /** Complete child environment, with undefined values omitted from identity. */
    env: NodeJS.ProcessEnv;

    /** Consumer project anchoring cache-root selection. */
    projectRoot: string;

    /** Resolved descriptor entry module whose evaluation is cached. */
    request: string;

    /** Executable that runs evaluation, identified by actual bytes and paths. */
    runtime: string;

    /** Ttsc build version, invalidating answers from another build. */
    version: string;
  }): string | null {
    // Startup preloads run before the descriptor recorder and can read inputs
    // it never sees; a stable option string cannot prove their current meaning.
    if (props.env.NODE_OPTIONS?.trim()) return null;
    const runtime = runtimeIdentity(props.runtime);
    if (runtime === null) return null;
    const additionalRuntime =
      props.additionalRuntime === undefined
        ? undefined
        : props.additionalRuntime === props.runtime
          ? runtime
          : runtimeIdentity(props.additionalRuntime);
    if (additionalRuntime === null) return null;
    let root: string;
    try {
      root = resolveSourceBuildCachePaths(
        props.projectRoot,
        props.cacheDir,
        props.env,
      ).root;
    } catch {
      return null;
    }
    const key = crypto
      .createHash("sha256")
      .update(
        JSON.stringify([
          FORMAT,
          props.version,
          path.resolve(props.request),
          props.context,
          Object.entries(props.env)
            .filter(
              (entry): entry is [string, string] => entry[1] !== undefined,
            )
            .sort(([left], [right]) =>
              left < right ? -1 : left > right ? 1 : 0,
            ),
          runtime,
          additionalRuntime,
        ]),
      )
      .digest("hex");
    return path.join(
      root,
      SourceBuildCacheLayout.DESCRIPTOR_CACHE_DIRNAME,
      `${key}.json`,
    );
  }

  /**
   * The recorded answer, or `null` when there is none whose inputs all still
   * hold the state they were read in. Every failure to prove it is `null`,
   * which means "evaluate the descriptor".
   *
   * @evidence contracts/common.md#principled-implementation Record/format validation and bidirectional hash/realpath comparison require a nonempty proven module population before returning the persisted evaluation.
   * @evidence contracts/common.md#clear-and-simple-design The reader answers only valid-entry or null; real descriptor execution remains the caller's response to a miss.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unreadable, malformed or changed entries become misses, without accepting stale descriptor data because the file exists.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc states the exact observation-state condition and null fallback, with separate acknowledgment prose under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Current native hash/realpath observations preserve content and physical selection independently, including symlink/junction retargeting.
   * @evidence contracts/performance.md#efficient-algorithms One parse and linear record comparisons plus current input byte hashing avoid child startup/module evaluation on a valid entry.
   * @evidence contracts/performance.md#reuse-equivalent-work Both content and physical identities must match the persisted evaluation proof; empty or unproved inputs never become reusable.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The returned parsed data belongs to the caller; recordCacheFileUse refreshes disk-entry last use for pruning, with no global in-memory answer map.
   */
  export function read(file: string): IEvaluation | null {
    let entry: unknown;
    try {
      entry = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return null;
    }
    if (!isEntry(entry) || entry.format !== FORMAT) return null;
    const hashed = Object.keys(entry.proof.hashes);
    if (
      hashed.length === 0 ||
      !sameMap(entry.proof.hashes, hashHostInputPaths(hashed)) ||
      !sameMap(
        entry.proof.realpaths,
        realpathHostInputPaths(Object.keys(entry.proof.realpaths)),
      )
    )
      return null;
    recordCacheFileUse(file);
    return entry.evaluation;
  }

  /**
   * Record an evaluation's answer with the state it was computed from.
   *
   * The state is the one the evaluation proved while it ran, never a reading
   * taken now: hashing the inputs here would pair the answer with a state it
   * may not have been computed from (samchon/ttsc#1504). An evaluation input
   * without both proofs leaves nothing that could prove the entry later, so
   * nothing is recorded, and neither is a fingerprint declaration no proof can
   * use, nor the answer of a descriptor that did not declare every file it read
   * (`declaresHostInputReads`). The owning runtime must explicitly finish its
   * observations; a partial side channel cannot establish the population. A
   * write failure only costs the next launch an evaluation.
   *
   * `defaultWorkspaceRoot` is supplied only when the caller selected default
   * storage. Its ownership marker precedes the first answer, so a later root
   * search does not mistake this newly populated cache for an older orphan. The
   * answer uses the marker's returned physical root, preserving placement if an
   * ancestor alias changes after selection.
   *
   * @evidence contracts/common.md#principled-implementation Persistence requires declared external reads and complete evaluation-time proof; a caller-authorized default root is marked before its first answer is published so later selection stays at that installation.
   * @evidence contracts/common.md#clear-and-simple-design One writer assembles proof and publishes the copied serialization while the loader decides whether printed side effects permit caching.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Fresh hashing is not used to bless a past answer, and missing or contradictory declaration proof refuses a write rather than compensating with guesses.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain evaluation-time identity, non-persistable inputs, best-effort writing and the caller's default-root authority before the tags.
   * @evidence contracts/portability.md#os-neutral-implementation Native path operations and the shared physical-root marker precede same-directory staging/rename without OS-specific shell publication.
   * @evidence contracts/performance.md#efficient-algorithms Set-based input deduplication and one pass over declared fingerprints assemble proof proportional to the observed population, without reading source bytes again.
   * @evidence contracts/performance.md#reuse-equivalent-work Only the fully proved evaluation is persisted under its locate key; declared fingerprints are compared with observations rather than replacing them silently.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Call-owned staging is removed in finally after failure or publication; disk answers fall under default single-file pruning, while explicit cache roots stay caller-owned.
   */
  export function write(
    file: string,
    evaluation: IEvaluation,
    defaultWorkspaceRoot?: string,
  ): void {
    if (
      evaluation.observationsComplete !== true ||
      !declaresHostInputReads(evaluation.descriptor)
    )
      return;
    const hashes: Record<string, string | null> = {};
    const realpaths: Record<string, string | null> = {};
    for (const input of new Set(
      evaluation.inputs.map((input) => path.resolve(input)),
    )) {
      if (
        !Object.prototype.hasOwnProperty.call(
          evaluation.hostInputHashes,
          input,
        ) ||
        !Object.prototype.hasOwnProperty.call(
          evaluation.hostInputRealpaths,
          input,
        )
      )
        return;
      hashes[input] = evaluation.hostInputHashes[input]!;
      realpaths[input] = evaluation.hostInputRealpaths[input]!;
    }
    const declared = declaredFingerprints(evaluation.descriptor);
    if (declared === null) return;
    for (const [input, hash] of Object.entries(declared)) {
      if (
        Object.prototype.hasOwnProperty.call(hashes, input) &&
        hashes[input] !== hash
      )
        return;
      // The descriptor's fingerprint of a file it read itself proves its
      // content; the physical path is proven only for what the evaluation saw.
      hashes[input] = hash;
    }
    if (Object.keys(hashes).length === 0) return;
    const entry: IEntry = {
      evaluation,
      format: FORMAT,
      proof: { hashes, realpaths },
    };
    let output = file;
    if (defaultWorkspaceRoot !== undefined) {
      if (
        path.dirname(file) !==
        path.join(
          defaultWorkspaceRoot,
          SourceBuildCacheLayout.DESCRIPTOR_CACHE_DIRNAME,
        )
      )
        return;
      try {
        const physicalRoot =
          SourceBuildCacheLayout.markDefaultWorkspaceCacheRoot(
            defaultWorkspaceRoot,
          );
        output = path.join(
          physicalRoot,
          SourceBuildCacheLayout.DESCRIPTOR_CACHE_DIRNAME,
          path.basename(file),
        );
      } catch {
        return;
      }
    }
    const staging = `${output}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      fs.mkdirSync(path.dirname(output), { recursive: true });
      // Written beside the entry and renamed, so a reader never sees a partial
      // entry that happens to parse.
      fs.writeFileSync(staging, JSON.stringify(entry), "utf8");
      fs.renameSync(staging, output);
    } catch {
      // The cache is an optimization over an evaluation that still works.
    } finally {
      try {
        fs.rmSync(staging, { force: true });
      } catch {
        // Best-effort staging cleanup cannot replace descriptor evaluation.
      }
    }
  }

  /**
   * Entry format tag. Moves when the entry shape or its proof rule changes, so
   * an entry written under another rule is evaluated again.
   */
  const FORMAT = "ttsc-descriptor-evaluation-v5";

  interface IEntry {
    evaluation: IEvaluation;
    format: string;
    proof: {
      hashes: Record<string, string | null>;
      realpaths: Record<string, string | null>;
    };
  }

  /**
   * The runtime executable as the key names it: its physical path with the
   * content digest and bracketed lexical/physical metadata, so replaced bytes
   * cannot reuse an evaluation by restoring size/timestamps. Null is unproved.
   */
  function runtimeIdentity(runtime: string): string | null {
    return runtimeExecutableIdentity(runtime) ?? null;
  }

  /**
   * The fingerprints a descriptor declared for the files it read itself
   * (`hostInputHashes`), keyed by resolved path, or `null` when the declaration
   * is not one a proof can use.
   */
  function declaredFingerprints(
    descriptor: unknown,
  ): Record<string, string | null> | null {
    const declared = (descriptor as { hostInputHashes?: unknown })
      .hostInputHashes;
    if (typeof declared !== "object" || declared === null) return null;
    const output: Record<string, string | null> = {};
    for (const [file, hash] of Object.entries(declared)) {
      if (!path.isAbsolute(file) || (hash !== null && typeof hash !== "string"))
        return null;
      output[path.resolve(file)] = hash;
    }
    return output;
  }

  function isEntry(value: unknown): value is IEntry {
    if (typeof value !== "object" || value === null) return false;
    const entry = value as Partial<IEntry>;
    const evaluation = entry.evaluation as Partial<IEvaluation> | undefined;
    return (
      typeof entry.format === "string" &&
      typeof entry.proof === "object" &&
      entry.proof !== null &&
      isStateMap(entry.proof.hashes) &&
      isStateMap(entry.proof.realpaths) &&
      typeof evaluation === "object" &&
      evaluation !== null &&
      evaluation.observationsComplete === true &&
      isStateMap(evaluation.hostInputHashes) &&
      isStateMap(evaluation.hostInputRealpaths) &&
      Array.isArray(evaluation.inputs) &&
      evaluation.inputs.every((input) => typeof input === "string")
    );
  }

  function isStateMap(value: unknown): value is Record<string, string | null> {
    return (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      Object.values(value).every(
        (state) => state === null || typeof state === "string",
      )
    );
  }

  /**
   * Whether two snapshots describe the same state, compared both ways: a key
   * the fresh snapshot lacks means the two were taken over different sets.
   */
  function sameMap(
    recorded: Record<string, string | null>,
    current: Record<string, string | null>,
  ): boolean {
    const keys = Object.keys(recorded);
    if (keys.length !== Object.keys(current).length) return false;
    return keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(current, key) &&
        recorded[key] === current[key],
    );
  }
}
