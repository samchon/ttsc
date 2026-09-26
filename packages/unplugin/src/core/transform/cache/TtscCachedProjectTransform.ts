import type { ITtscCompilerTransformation } from "ttsc";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import type { TtscProjectDirectorySnapshot } from "../project/TtscProjectDirectorySnapshot";
import type { TtscProjectMutationTracker } from "../tracker/TtscProjectMutationTracker";
import type { TtscHostInputValidation } from "../validation/TtscHostInputValidation";

/**
 * A single entry in the project transform cache.
 *
 * Stores the full compiler result together with SHA-256 hashes of every project
 * input file. In a cache with an explicit build lifecycle, the first delivery
 * of each compiled module compares its supplied source with the generation
 * snapshot in constant time. Later graph-bearing deliveries validate only the
 * requested file's derived inputs plus exact host descriptor/config inputs;
 * graph-free envelopes retain complete-snapshot validation.
 */
export interface TtscCachedProjectTransform {
  /** Predicate-preserving compiler proofs for external candidate spellings. */
  externalInputObservations?: Record<
    string,
    ITtscCompilerTransformation.IInputObservation
  >;
  /**
   * SHA-256 hash of every input the compiler reported outside the project walk
   * (keyed by filesystem identity), captured at the time of the transform.
   *
   * The project walk cannot see files outside the project root or under ignored
   * directories (`node_modules` declarations, monorepo sibling sources,
   * out-of-root tsconfig `extends` ancestry), yet the host-owned reference
   * graph proves they are transform inputs. Every host keeps its generation
   * across builds, so without these hashes it would replay a project transform
   * computed against a stale out-of-walk input: Metro workers and the Turbopack
   * loader for the whole process lifetime, and a host with a build boundary on
   * every rebuild. A host with a boundary proves them once per pass, at the
   * pass's first delivery (samchon/ttsc#1300); one without proves them on every
   * delivery its notifications cannot vouch for.
   */
  externalInputHashes?: Record<string, string>;
  /**
   * Compiler-time physical identities for graph-owned entries in
   * {@link externalInputHashes}. Dependency-only paths have no generation
   * realpath protocol and therefore omit this evidence; the target a dependency
   * selected is compared only across its own compile (samchon/ttsc#1541).
   */
  externalInputRealpaths?: Record<string, string | null>;
  /**
   * The plugin-reported dependency-only paths among {@link externalInputPaths},
   * which the next compile of the project reads before it starts, so the state
   * it reads after can be certified (samchon/ttsc#1541).
   */
  externalDependencyInputs?: string[];
  /**
   * Original absolute spellings of {@link externalInputHashes} inputs. These
   * stay separate from their identity keys so validation reads the paths the
   * compiler reported rather than a normalized replacement spelling.
   */
  externalInputPaths?: string[];
  /**
   * Metadata signature of each out-of-walk input, captured around the read that
   * proved its {@link externalInputHashes} entry and recorded only once the
   * observed filesystem's clock provably left the stamp's tick
   * (`stampSeparable`). An input whose signature still holds carries the
   * recorded content, so revalidation may skip the read.
   *
   * Keyed by lexical spelling rather than by physical identity, for the reason
   * {@link TtscHostInputValidation} states: a symlink or junction spelling and
   * its selected target deliberately share one identity but have different
   * metadata, so an identity key would let the two overwrite each other's
   * signature and force both to be re-read on every delivery.
   */
  externalInputSignatures?: Record<string, string>;
  /**
   * SHA-256 hash of each project-relative input path at the time of the
   * transform.
   */
  inputHashes: Record<string, string>;
  /**
   * What the resolved configuration admitted into this generation's program.
   *
   * Recorded per generation rather than read per validation because it is a
   * property of the configuration the compile ran under, so a later delivery
   * must judge membership by the same rule the compile did. A tsconfig edit
   * that changes the rule also changes a declared input, which replaces the
   * generation and its policy together.
   */
  membershipPolicy: ITtscProjectMembershipPolicy;
  /**
   * Files whose delivered text was found to differ from the file on disk, so
   * the notice is one per file per generation (samchon/ttsc#1394).
   */
  divergentDeliveryReported?: Set<string>;
  /**
   * Files already reported as absent from the program, and the pass that
   * reporting belongs to, so the notice is one per file per pass rather than
   * one per delivery.
   */
  missingOutputReported?: Set<string>;
  /**
   * The pass {@link missingOutputReported} belongs to; a new pass clears the
   * set.
   */
  missingOutputEpoch?: number;
  /**
   * The project config this generation compiled, so a module the program does
   * not contain can be told which program that was.
   */
  tsconfig: string;
  /**
   * Metadata signature of each {@link inputHashes} entry whose hash was proven
   * against an unracing read of the file on disk, in a tick the observed
   * filesystem's clock had provably left (`stampSeparable`).
   *
   * The generation's own current file is no exception. The compile reads it
   * from disk, so its recorded hash is the disk's like every other input's, and
   * the delivered text never replaces it (samchon/ttsc#1394).
   */
  inputSignatures?: Record<string, string>;
  /**
   * Raw source hash of every readable key in the transform output, keyed by
   * filesystem identity. Unlike {@link inputHashes}, this includes source
   * outputs outside the project walk without adding arbitrary output keys to
   * the complete project snapshot.
   */
  sourceHashes?: Record<string, string>;
  /** Metadata snapshot of every directory in the stable generation walk. */
  projectDirectories?: TtscProjectDirectorySnapshot[];
  /** Live notification state for universal host-input changes. */
  hostInputMutationTracker?: TtscProjectMutationTracker;
  /**
   * Live notification state for the generation's absent resolution candidates
   * and the directories that carry them.
   *
   * Separate from the universal-input tracker because it listens for a
   * different thing. Every event that can make an absent candidate present is a
   * rename — the file appearing, a component of the path being created,
   * replaced, or retargeted — so a change event on one of these names is never
   * evidence this tracker exists to collect. What it is, on a backend that
   * reports a write below a directory as a change to that directory's own entry
   * (Windows does), is a dev server's steady traffic: listening for every event
   * would replace the generation each time a bundler wrote inside
   * `node_modules`. The filter therefore drops noise without dropping proof.
   * The one appearance it cannot see is a Windows junction retargeted in place
   * through `FSCTL_SET_REPARSE_POINT`, which no mainstream tool does; every
   * package manager replaces the entry instead, which is a rename.
   */
  candidateMutationTracker?: TtscProjectMutationTracker;
  /**
   * Universal descriptor/config inputs proven once at generation time, then by
   * metadata.
   *
   * Recorded state of the generation, like the input hashes and the directory
   * snapshot beside it, rather than state derived from the envelope: an entry
   * carries the manifest that proved it, so nothing can present one
   * generation's recorded inputs under another envelope's proof.
   */
  hostInputValidation?: TtscHostInputValidation;
  /** Live notification state for file/directory creation, deletion, and rename. */
  projectMutationTracker?: TtscProjectMutationTracker;
  /** Whether a generated wrapper and its source config graph stayed coherent. */
  configStateComplete?: boolean;
  /**
   * Whether the project and its configuration held still across the compile, as
   * `projectWalkStable` decides from the walks before and after it and the
   * tracker opened before it.
   *
   * A failed compile whose project moved is a verdict about a state already
   * gone, so it is compiled again like a success whose proof was lost; so is a
   * compile adopted from the session whose external inputs have moved since its
   * publisher read them (samchon/ttsc#1458).
   */
  projectHeldStill?: boolean;
  /**
   * Whether the generation-time project walk observed every directory and file
   * it attempted to snapshot. An incomplete walk may never authorize narrow
   * validation; a later complete walk must be allowed to replace it.
   */
  projectSnapshotComplete?: boolean;
  /** Absolute path to the directory that owns the tsconfig. */
  projectRoot: string;
  /**
   * Raw compiler output: what `TtscCompiler.transformAsync` returned for this
   * generation's compile (samchon/ttsc#1391), or the publication another worker
   * of the host's session made after proving the same project state
   * (samchon/ttsc#1390).
   */
  result: ITtscCompilerTransformation;
  /**
   * The delivery epoch this generation is currently settled against, or
   * `undefined` for a generation no epoch has proven.
   *
   * Set when the generation is compiled, and again whenever a later epoch's
   * first delivery proves the whole generation still matches the filesystem.
   * While it equals the cache's current epoch, each module's first delivery is
   * settled by the supplied source alone, exactly as it was when every pass
   * compiled its own generation (samchon/ttsc#1300).
   */
  deliveryEpoch?: number;
  /**
   * Whether this generation's non-error diagnostics have been surfaced at all,
   * and the epoch they were last surfaced in.
   *
   * The diagnostics describe one compile of one program, so they belong to the
   * generation rather than to a delivery; a pass that reuses a retained
   * generation still surfaces them once, because a build's warnings are part of
   * what that build reports (samchon/ttsc#1304). The two fields are separate so
   * a persistent host, whose epoch is `undefined`, still reports the first
   * time.
   */
  diagnosticsReported?: boolean;
  /**
   * The pass the diagnostics were last surfaced in; see
   * {@link diagnosticsReported}.
   */
  diagnosticsEpoch?: number;
  /**
   * Files already delivered from this generation, keyed by filesystem identity.
   * A cache with a delivery epoch uses this to skip persistent validation only
   * for a module's first delivery inside the current pass; the set is cleared
   * whenever a new epoch's gate re-proves the generation.
   */
  servedFiles?: Set<string>;
  /**
   * Absolute path of the adapter-owned scratch directory used for this
   * generation. It is disposed after compilation, so none of its compiler,
   * resolver, or plugin artifacts can be a persistent cache or watch input. An
   * adopted publication carries the publisher's, since that is the directory
   * its envelope names.
   */
  scratchDirectory?: string;
  /**
   * Absolute path of the generated temp-dir tsconfig this compile ran against,
   * when an alias/compiler-options overlay required one. The compiler reports
   * it in the envelope's `graph.configs` chain, but it is disposed right after
   * the compile, so registering it as a watch input would invalidate every
   * bundler cache snapshot on the next build; watch derivation must skip this
   * path. {@link scratchDirectory} owns the wider disposable-input bound. An
   * adopted publication carries the publisher's, as with that directory.
   */
  temporaryTsconfig?: string;
}
