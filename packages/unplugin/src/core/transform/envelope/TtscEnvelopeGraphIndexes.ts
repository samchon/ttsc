import type { ITtscCompilerTransformation } from "ttsc";

/**
 * Reference-graph indexes shared by every watch-input derivation.
 *
 * Physical identities coalesce reachability vertices, while lexical spellings
 * retain separate compiler predicate observations and alias-sensitive inputs.
 * The builder validates observations; this interface only represents the result.
 *
 * @evidence contracts/common.md#principled-implementation Identity-keyed edges represent reachability independently of lexical proof keys; separate conflict sets retain contradictory observations instead of choosing an arbitrary usable proof.
 * @evidence contracts/common.md#clear-and-simple-design Adjacency, universal inputs and predicate proof maps remain separate fields because their consumers ask different questions about the same generation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Speculative inputs and explicit failure/conflict sets represent supported weaker evidence without inventing content hashes or hiding contradictions.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains identity versus spelling and the builder's validation responsibility; member comments define speculative inputs and proof states with blank member and tag separation under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Identity keys come from the envelope's filesystem context, while proof keys retain native absolute lexical spellings; this representation does not equate case folding with an operating-system name.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscEnvelopeGraphIndexes only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscEnvelopeGraphIndexes only declares a shape; it has no work to reuse
 *   at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscEnvelopeGraphIndexes only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface TtscEnvelopeGraphIndexes {
  /** Identity of each direct-edge source -> its resolved absolute targets. */
  readonly edges: Map<string, string[]>;

  /** Identity of each direct-edge source -> its absolute spelling. */
  readonly spellings: Map<string, string>;

  /** Importer-owned resolver-input entries, sources pre-identified. */
  readonly candidates: { source: string; files: string[] }[];

  /** Resolved absolute `graph.globals` members, inputs of every source file. */
  readonly globals: string[];

  /** Resolved absolute `graph.configs` members: the tsconfig `extends` chain. */
  readonly configs: string[];

  /** Resolver inputs whose state affects every source file. */
  readonly resolutionInputs: string[];

  /** Every realized or resolver-input path, keyed by lexical spelling. */
  readonly memberSpellings: Set<string>;

  /**
   * Predicate-only resolver inputs, keyed by absolute lexical spelling. These
   * are exact compiler calls but need not carry file content, for example a
   * failed file predicate or automatic type-root directory enumeration. A path
   * that is also a realized edge, global, config, or source keeps the stronger
   * realized-file standard.
   */
  readonly speculative: Set<string>;

  /** Compiler-time legacy proof keyed by absolute lexical spelling. */
  readonly inputProofs: Map<
    string,
    { hash: string | null; path: string; realpath: string | null }
  >;

  /** Native compiler-observation failure keyed by absolute lexical spelling. */
  readonly inputProofFailures: Map<string, string>;

  /** Graph proof spellings that reported contradictory generation states. */
  readonly inputProofConflicts: Set<string>;

  /** Predicate-preserving proofs keyed by absolute lexical spelling. */
  readonly inputObservations: Map<
    string,
    ITtscCompilerTransformation.IInputObservation
  >;

  /** Absolute spellings whose predicate proof is malformed or contradictory. */
  readonly inputObservationConflicts: Set<string>;
}
