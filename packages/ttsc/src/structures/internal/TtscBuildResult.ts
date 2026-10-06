import type { ITtscCompilerDiagnostic } from "../ITtscCompilerDiagnostic";
import type { ITtscCompilerTransformation } from "../ITtscCompilerTransformation";

/**
 * Internal result captured from TypeScript-Go or native plugin sidecars.
 *
 * @evidence contracts/common.md#principled-implementation Exit status, actual normal completion, diagnostics, streams, check-generation witnesses and optional emitted-source provenance remain separate. Absent provenance, an unknown output's empty source list and a complete empty output map differ; null input witnesses record absence while missing keys establish no reusable proof.
 * @evidence contracts/common.md#clear-and-simple-design One result record carries process facts and separately requested emitted-file/provenance data without making display-text parsing responsible for source ownership.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Streams derive from actual host output, though failure normalization can move stdout into stderr and phase composition can concatenate them. Numeric status remains separate from normal-completion proof; neither diagnostic text nor normalization invents successful execution or source ownership.
 * @evidence contracts/common.md#meaningful-documentation Native comments state status versus actual completion, emitted-list availability, generation ownership, null versus missing witnesses and unknown/ambiguous provenance states; member and tag separation follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Provenance distinguishes actual absolute native output spelling from physical source identity captured by the producer or stable external observations; neither path is case-folded or reconstructed from a URL, and each producer owns its resolution premise.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface TtscBuildResult {
  /** Compiler-time graph of the same check generation, when transported. */
  graph?: ITtscCompilerTransformation.IReferenceGraph;
  /** Structured compiler/plugin diagnostics, supplied or parsed from output. */
  diagnostics: ITtscCompilerDiagnostic[];

  /** Files written by the build when emitted-file listing was requested. */
  emittedFiles?: string[];

  /**
   * Emitter provenance for actual written JavaScript outputs. Keys are absolute
   * native output spellings; values retain contributing physical source paths.
   * Native producers capture those identities in the compile generation. The
   * external compiler adapter instead requires matching pre/post source
   * selection, effective options, physical identities and contents, including
   * the selected executable. It cannot detect a concurrent change restored
   * between observations.
   *
   * Multiple sources are ambiguous for single-file routing, and an empty list
   * means the producer could not establish full ownership under its premise.
   *
   * Absent means unavailable or an older producer. A present empty map means a
   * supported producer reported no eligible written JavaScript output.
   * Consumers must not infer source ownership from emitted filenames in either
   * unknown state. Provenance does not by itself establish overall build
   * success.
   */
  emittedSources?: Record<string, readonly string[]>;

  /**
   * Actual proof-refusal reasons for reported output paths. Diagnostic context
   * alone establishes no source ownership and does not replace compiler
   * errors.
   */
  emittedSourceProofFailures?: Readonly<Record<string, string>>;

  /** Native inputs declared or observed by the contributing check generations. */
  hostInputs?: string[];

  /**
   * Generation-captured SHA-256 witnesses, keyed by declared native input. Null
   * records observed absence; a missing key supplies no reusable proof.
   */
  hostInputHashes?: Record<string, string | null>;

  /**
   * Generation-captured physical paths, or null for observed absence. Missing
   * keys preserve unavailable or conflicting proof without a later realpath.
   */
  hostInputRealpaths?: Record<string, string | null>;

  /** A contributing producer explicitly reported incomplete observations. */
  observationsComplete?: false;

  /**
   * Actual spawn completion fact before null-status coercion. True requires a
   * present native exit status and no terminating signal; absence proves no
   * completion premise for generation-owned metadata.
   */
  processCompletedNormally?: boolean;

  /** Process-style exit status. `0` means success. */
  status: number;

  /** Host stdout text after any failure normalization or phase composition. */
  stdout: string;

  /** Host stderr text after any failure normalization or phase composition. */
  stderr: string;
}
