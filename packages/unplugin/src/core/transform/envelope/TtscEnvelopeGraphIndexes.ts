import type { ITtscCompilerTransformation } from "ttsc";

/** Reference-graph indexes shared by every watch-input derivation. */
export interface TtscEnvelopeGraphIndexes {
  /** Identity of each direct-edge source -> its resolved absolute targets. */
  readonly edges: Map<string, string[]>;
  /** Identity of each direct-edge source -> its absolute spelling. */
  readonly spellings: Map<string, string>;
  /** Importer-owned resolver-input entries, sources pre-identified. */
  readonly candidates: { source: string; files: string[] }[];
  /** Resolved absolute `graph.globals` and `graph.configs` members. */
  readonly globals: string[];
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
