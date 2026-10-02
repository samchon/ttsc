import type { ITtscCompilerTransformation } from "ttsc";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import type { TtscProjectDirectorySnapshot } from "../project/TtscProjectDirectorySnapshot";
import type { TtscProjectMutationTracker } from "../tracker/TtscProjectMutationTracker";
import type { TtscHostInputValidation } from "../validation/TtscHostInputValidation";

/**
 * A single entry in the project transform cache.
 *
 * Stores a compiler result with admitted project-walk hashes, external and
 * universal proofs, and optional native notification owners. The walk is not
 * the complete compiler program: imported, linked and excluded-tree inputs
 * retain their separate recorded authority.
 *
 * In an explicit delivery epoch, the first delivery proves the complete stable
 * generation before later first deliveries may share that proof. Deliveries
 * reaching source-baseline comparison still cost a text hash and may require
 * disk comparison when they diverge; unrelated modules can return before it.
 * Persistent graph-bearing requests may use derived-input validation
 * only with qualified membership and universal authority; unavailable narrow
 * proof uses the complete recorded snapshot.
 *
 * @evidence contracts/common.md#principled-implementation Compiler output travels with generation-time hashes, membership policy, physical identities, and proof completeness, preventing a later delivery's reading from silently replacing compile-time evidence.
 * @evidence contracts/common.md#clear-and-simple-design One generation owns its proof snapshots, reporting state, and tracker handles; separate fields represent distinct content, spelling, identity, and lifecycle responsibilities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Optional proof fields represent unavailable evidence rather than implied success; consumers must select the complete validation path when narrow proof is unsupported.
 * @evidence contracts/common.md#meaningful-documentation Member comments explain why hashes and signatures differ, why lexical spellings remain separate from identity, and which owner controls each delivery and resource lifetime.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   This native boundary carrier keeps lexical spellings, physical identity
 *   keys, compiler comparison policy, metadata signatures and actual tracker
 *   capabilities distinct. Producers and validators own platform-specific
 *   resolution and notification authority; a retained handle alone proves no
 *   unchanged state, and this representation applies no OS-name casing rule.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscCachedProjectTransform only declares a shape; it has no computation
 *   at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscCachedProjectTransform only declares a shape; it has no work to reuse
 *   at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscCachedProjectTransform only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface TtscCachedProjectTransform {
  /** Predicate-preserving compiler proofs for external candidate spellings. */
  externalInputObservations?: Record<
    string,
    ITtscCompilerTransformation.IInputObservation
  >;

  /**
   * Content or kind/missing fingerprints for external inputs represented by a
   * hash baseline, keyed by filesystem identity. Predicate-bearing speculative
   * spellings instead retain {@link externalInputObservations}; not every
   * external path has a hash entry.
   *
   * The project walk cannot see files outside the project root or under ignored
   * directories (`node_modules` declarations, monorepo sibling sources,
   * out-of-root tsconfig `extends` ancestry), yet the host-owned reference
   * graph can prove they are transform inputs. A retained generation must keep
   * their authority independently of project hashes. The first delivery of a
   * new epoch proves the complete snapshot; persistent deliveries select their
   * required scope or complete fallback rather than inferring freshness from
   * an adapter's process lifetime.
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
   * Original absolute spellings of selected external inputs, including paths
   * represented by predicate observations rather than hashes. These stay
   * separate from identity keys so validation replays each reported alias.
   */
  externalInputPaths?: string[];

  /**
   * Optional metadata signature earned around a successful external content or
   * predicate comparison and recorded only once the observed filesystem's
   * clock provably left the stamp's tick
   * (`stampSeparable`). Qualified matching metadata may replace that input's
   * recorded content or predicate comparison; other authority remains separate.
   *
   * Keyed by lexical spelling rather than by physical identity, for the reason
   * {@link TtscHostInputValidation} states: a symlink or junction spelling and
   * its selected target deliberately share one identity but have different
   * metadata, so an identity key would let the two overwrite each other's
   * signature and force both to be re-read on every delivery.
   */
  externalInputSignatures?: Record<string, string>;

  /**
   * Raw byte hashes of admitted regular files observed by the project walk.
   * Keys are project-relative physical identities or full outside-root identity
   * addresses under the compiler slash protocol; completeness is separate.
   */
  inputHashes: Record<string, string>;

  /**
   * Root-file discovery policy under the resolved configuration and recorded
   * comparison rule: a reported compiler answer when available, otherwise the
   * primed provisional rule. This is not a complete list of imported files.
   *
   * Recorded per generation rather than read per validation because it is a
   * property of the configuration the compile ran under, so a later delivery
   * must judge membership by the same rule the compile did. A tsconfig edit
   * that changes the rule also changes a declared input, which replaces the
   * generation and its policy together.
   */
  membershipPolicy: ITtscProjectMembershipPolicy;

  /**
   * Native resolved spellings whose divergence warning has been attempted in
   * this generation. Recording precedes stderr writing; distinct physical
   * aliases may retain separate keys, and stream failure does not remove one.
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
   * Optional metadata signature of an {@link inputHashes} entry earned around
   * a metadata-bracketed disk read, in a tick the observed
   * filesystem's clock had provably left (`stampSeparable`).
   *
   * The generation's own current file is no exception. The compile reads it
   * from disk, so its recorded hash is the disk's like every other input's, and
   * the delivered text never replaces it (samchon/ttsc#1394).
   */
  inputSignatures?: Record<string, string>;

  /**
   * Native host-state hashes for source paths named by transform outputs,
   * keyed by filesystem identity, including paths outside the project walk.
   * Failed reads of observed directories retain the host-state directory
   * marker; other failed reads supply no entry. The current source identity is
   * overwritten with its post-compile walk hash when available, or its delivered
   * text hash otherwise, even without an output key. That fallback is not
   * compiler-observed disk proof and cannot grant generation completeness.
   * Unlike {@link inputHashes}, this map does not add output names to the
   * complete project-walk key universe.
   */
  sourceHashes?: Record<string, string>;

  /** Observed directory membership signatures; completeness remains separate. */
  projectDirectories?: TtscProjectDirectorySnapshot[];

  /** Live notification state for universal host-input changes. */
  hostInputMutationTracker?: TtscProjectMutationTracker;

  /**
   * Live notification state for the generation's absent resolution candidates
   * and the directories that carry them.
   *
   * Capture opens it with rename selection, independently of universal content
   * tracking. Exact coverage, native backend content authority, event overlap,
   * drainage and watched-directory identity qualify whether silence can replace
   * a direct candidate probe. Unavailable or uncertain authority leaves the
   * recorded candidate on direct validation; a platform or package-manager
   * assumption cannot certify every possible native alias or retarget.
   */
  candidateMutationTracker?: TtscProjectMutationTracker;

  /**
   * Universal descriptor/config, absent-path and plugin-tree authority.
   * Each validator chooses content, native absence/kind/identity or qualified
   * tree/environment proof; metadata alone cannot replace every obligation.
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
   * Whether the project/config walk verdict held through the compile and the
   * capture's external dependency or adopted-publication evidence did not
   * withdraw that verdict. The project half uses before/after observations and
   * any tracker opened before the compile, not an atomic filesystem freeze.
   *
   * A failed compile whose project moved is a verdict about a state already
   * gone, so it is compiled again like a success whose proof was lost; so is a
   * compile adopted from the session whose external inputs have moved since its
   * publisher read them (samchon/ttsc#1458).
   */
  projectHeldStill?: boolean;

  /**
   * Combined reusable-generation proof: stable project/config observations,
   * compiler graph proofs, complete external authority, successful adoption
   * comparison and universal manifest admission. A complete walk alone does
   * not set this flag; false cannot authorize narrow or first-delivery reuse.
   */
  projectSnapshotComplete?: boolean;

  /**
   * A locally admitted answer with incomplete host observations cannot be
   * retained for resident, shared or persistent reuse. Successful answers need
   * only explicit unavailable observations; diagnostic admission keeps its
   * existing current-verdict policy. This flag never grants admission itself.
   */
  freshDeliveryOnly?: boolean;

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
   * While it equals the current epoch, later first deliveries can share that
   * whole-generation proof. Delivered source still compares with its selected
   * baseline; divergent text requires the disk comparison before this shortcut.
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
   * Admitted module-selection checkpoints, keyed by filesystem identity.
   * Marking follows watch notification, including a missing-output continuation,
   * but precedes final host-value construction; it does not certify completed
   * downstream delivery.
   * A cache with a delivery epoch uses this to skip persistent validation only
   * for a module's first delivery inside the current pass; the set is cleared
   * whenever a new epoch's gate re-proves the generation.
   */
  servedFiles?: Set<string>;

  /**
   * Absolute path of the adapter-owned scratch directory used for this
   * generation. Capture attempts owned cleanup after compilation and excludes
   * its artifacts from persistent cache/watch inputs by ownership, even when
   * native removal fails. An adopted publication carries the publisher's,
   * since that is the directory its envelope names.
   */
  scratchDirectory?: string;

  /**
   * Absolute path of the generated temp-dir tsconfig this compile ran against,
   * when an alias/compiler-options overlay required one. The compiler reports
   * it in the envelope's `graph.configs` chain, but it belongs to disposed
   * capture scratch rather than persistent inputs, so registering it would
   * invalidate later snapshots after removal; watch derivation must skip this
   * path. {@link scratchDirectory} owns the wider disposable-input bound. An
   * adopted publication carries the publisher's, as with that directory.
   */
  temporaryTsconfig?: string;
}
