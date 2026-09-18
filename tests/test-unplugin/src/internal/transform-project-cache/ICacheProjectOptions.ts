import type { ICandidateFilesystemIo } from "./ICandidateFilesystemIo";

/**
 * Options for the synthetic multi-file project used by the cache scenarios.
 *
 * `emitExternalKey` makes the fixture transform emit one output entry keyed
 * outside the project's directory walk (a `node_modules/**` path), reproducing
 * what the native host does for program dependencies (`node_modules`
 * declarations, sibling-package sources). `graphFanout` makes the fixture stamp
 * a reference-graph envelope where every module edges to every sibling plus
 * that many planted `node_modules/dep{j}/index.d.ts` declarations — the shape
 * typia >= 13.1.19 produces.
 *
 * `graphGlobals` plants that many `node_modules/global{j}/index.d.ts` files and
 * stamps them into the envelope's `graph.globals`, the shape a real program
 * produces for every global-scope declaration package (`@types/node` first of
 * all). Unlike edges, globals belong to every delivered module at once, so they
 * are the input class a per-delivery revalidation multiplies by module count.
 * It requires a positive `graphFanout`: the fixture builds the whole `graph`
 * section only for a graph-bearing envelope, so globals alone would produce no
 * graph at all and silently exercise complete-snapshot validation instead.
 */
export interface ICacheProjectOptions {
  /** Capture public watch evidence while delivering the fixture's modules. */
  captureWatchEvidence?: boolean;
  /** Count cache filesystem reads for the first speculative candidate. */
  candidateFilesystemIo?: ICandidateFilesystemIo;
  /** Keep a private source tree for scenarios that mutate its descriptor. */
  isolatedPluginSource?: boolean;
  /**
   * Widen the program to JavaScript, which widens what counts as a membership
   * change with it: an emitted `.js` beside the sources can enter a program
   * that admits JavaScript, and must then invalidate the generation.
   */
  allowJs?: boolean;
  /** Same, for `.json` inputs. */
  resolveJsonModule?: boolean;
  /** Override the project's `outDir`, which the walk excludes by configuration. */
  outDir?: string;
  /**
   * Top-level `exclude` entries. TypeScript still keeps an _imported_ file in
   * the program whatever `exclude` says, which is what makes an excluded
   * directory holding a real graph member reachable.
   */
  exclude?: string[];
  /**
   * Add a second lexical spelling of one global — a file symlink beside it —
   * and stamp both into `graph.globals`, the alias first.
   *
   * The two share one physical identity but not their metadata, which is what
   * separates a per-spelling proof from a per-identity one. Order matters:
   * `deriveWatchInputs` deduplicates graph inputs by identity, so only the
   * first spelling is validated per delivery, while the out-of-walk snapshot
   * keeps both and records the _last_ one under a shared identity key. Stamping
   * the alias first therefore makes a per-identity manifest answer the wrong
   * spelling and re-read the file on every delivery, which is the cost the
   * per-spelling proof exists to avoid.
   *
   * Requires a positive `graphGlobals` (the directory it links inside is one of
   * those globals) and a positive `graphFanout` (the fixture builds the whole
   * `graph` section only for a graph-bearing envelope).
   *
   * POSIX only: creating a file symlink on Windows needs elevation, so the
   * option is dropped there and the case keeps its other assertions on every
   * platform.
   */
  aliasedGlobal?: boolean;
  /**
   * Give aliased speculative candidates a proof and a failure under separate
   * spellings.
   */
  lexicalCandidateProofFailureAlias?: boolean;
  emitExternalKey?: boolean;
  /** Emit this many transformable `.ts` outputs under ignored node_modules. */
  externalSourceOutputs?: number;
  /** Change the first external source after its compiler read on attempt one. */
  externalSourceChangesAfterRead?: boolean;
  externalSnapshotAbaRace?: boolean;
  fileCount?: number;
  graphFanout?: number;
  /**
   * Stamp this many superseding resolution candidates per module: higher
   * priority spellings (`node_modules/dep{j}/index.ts`) that do not exist and
   * that the fixture deliberately leaves without a compiler proof, exactly as
   * `driver.ObserveProgramResolutions` does for every real project whose
   * resolution passes over a `.ts` spelling on its way to a `.d.ts`.
   *
   * Requires a positive `graphFanout`: the fixture builds the whole `graph`
   * section only for a graph-bearing envelope.
   */
  graphCandidates?: number;
  /** Report a failed observed predicate for the first speculative candidate. */
  candidateProofFailure?: boolean;
  /** Report a valid rich file predicate with an unrepresentable legacy proof. */
  richCandidateProof?: boolean;
  /** Report mutually inconsistent rich and legacy proofs for one candidate. */
  contradictoryRichCandidateProof?: boolean;
  /** Pair an unprojectable rich predicate with a supplied legacy proof. */
  unprojectableContradictoryRichCandidateProof?: boolean;
  graphGlobals?: number;
  omitExternalSourceGraphNode?: boolean;
  /**
   * Stamp one extra resolution candidate at this absolute spelling, which the
   * caller places outside the project root.
   *
   * The bound the absent-candidate watch declines at: the chain that proves a
   * candidate absent stops at the project's own root, so a spelling that leaves
   * the subtree before reaching it cannot be covered and is not claimed at all.
   * Only an absolute path exercises it, since a project-relative one can never
   * leave.
   */
  outOfProjectCandidate?: string;
  /**
   * Project-relative path the fixture transform writes while the compile runs,
   * for a file that is not an input of that compile (a build log, a coverage
   * report, a framework's generated artifact). It must not cost the
   * generation.
   */
  nonInputRaceFile?: string;
  /**
   * Drop the compiler proof of one realized graph edge target entirely, the
   * shape a host reports for an input it read but could not prove. Unlike a
   * candidate, this must refuse reuse.
   */
  unprovenGraphInput?: boolean;
  /** Drop this many realized external graph proofs for witness-bound tests. */
  unprovenGraphInputs?: number;
  /**
   * Stamp one graph member with no compiler-time content hash while keeping its
   * physical-identity proof, the shape a host reports for an input it could see
   * but not read. Pairs with a cache whose `readFile` refuses that path, which
   * makes the state deterministic on every platform.
   */
  unhashedGraphInput?: boolean;
  /**
   * Declare one out-of-walk universal host input that exists but cannot be
   * read, as a link with no target. The host and the adapter then record the
   * same missing state for it, which is the state no signature may stand for.
   *
   * Windows uses a directory junction: a file symlink needs elevation there
   * while a junction does not, and a junction with no target reports the same
   * state this needs, a readable link whose every traversal fails.
   */
  unreadableHostInput?: boolean;
  independentGraphLeaf?: string;
  partitionGraph?: boolean;
  snapshotAbaRace?: boolean;
  unrelatedDirectoryCount?: number;
}
