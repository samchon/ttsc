import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import { normalizeBuildOutput } from "./normalizeBuildOutput";

/**
 * Merge two `TtscBuildResult` values into one.
 *
 * - `status`: the right status wins unless it is 0 (failure propagates).
 * - `diagnostics`: concatenated left then right.
 * - `emittedFiles`: right wins when present, otherwise left is kept.
 * - `emittedSources`: only the right phase's proof survives. An unknown later
 *   producer must not inherit an earlier phase's source ownership.
 * - `stdout`/`stderr`: concatenated left then right.
 * - Check inputs are unioned; independently compatible content and physical
 *   witnesses survive. A lost witness cannot be restored by a later phase.
 *   Explicit observation incompleteness is sticky.
 *
 * The shared normalizer moves combined stdout to stderr when the merged result
 * failed and stderr is blank, preserving visibility for stderr-only consumers.
 *
 * @evidence contracts/common.md#principled-implementation Ordered concatenation preserves both phases' reports and failures; only the right phase's emitted-source proof and completion fact survive. Check declarations and explicit incompleteness accumulate, while each content/physical witness must agree across every declaring phase and a lost witness cannot be restored later.
 * @evidence contracts/common.md#clear-and-simple-design Field selection is explicit in one result literal; one private witness merger applies the same independent compatibility rule to content and physical identity, and the shared normalizer owns output visibility.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Status and emitted-file selection follow phase-result semantics without special cases for particular plugins or errors.
 * @evidence contracts/common.md#meaningful-documentation The native list describes each field's precedence, including why provenance differs from emitted-file listing; prose and tags are separated.
 * @evidence contracts/performance.md#efficient-algorithms Diagnostic arrays and text are concatenated once, and input witnesses use indexed membership in O(total report bytes and input count); supplied diagnostics prevent the normalizer from reparsing them.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Combining two supplied results does not coordinate shared production or cross-request work.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned result transfers combined data to the caller and no history or handle is retained.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Input spellings and witness values are compared literally as producer-reported data; their native path and identity interpretation belongs to producers and proof consumers. Supplied diagnostics bypass the normalizer's native path parser.
 */
export function appendBuildOutput(
  left: TtscBuildResult,
  right: TtscBuildResult,
): TtscBuildResult {
  const hostInputs = [
    ...new Set([...(left.hostInputs ?? []), ...(right.hostInputs ?? [])]),
  ];
  return normalizeBuildOutput({
    diagnostics: [...left.diagnostics, ...right.diagnostics],
    emittedFiles:
      right.emittedFiles !== undefined ? right.emittedFiles : left.emittedFiles,
    emittedSources: right.emittedSources,
    emittedSourceProofFailures: right.emittedSourceProofFailures,
    processCompletedNormally: right.processCompletedNormally,
    ...(left.hostInputs === undefined && right.hostInputs === undefined
      ? {}
      : {
          hostInputs,
          hostInputHashes: mergeInputWitnesses(
            left,
            right,
            "hostInputHashes",
            hostInputs,
          ),
          hostInputRealpaths: mergeInputWitnesses(
            left,
            right,
            "hostInputRealpaths",
            hostInputs,
          ),
        }),
    ...(left.observationsComplete === false ||
    right.observationsComplete === false
      ? { observationsComplete: false as const }
      : {}),
    status: right.status !== 0 ? right.status : left.status,
    stdout: left.stdout + right.stdout,
    stderr: left.stderr + right.stderr,
  });
}

/**
 * A phase declaring an input must agree with every other declaring phase.
 * Retaining declarations after proof loss makes that loss sticky across later
 * merges; phases with no declaration do not invalidate an earlier witness.
 */
function mergeInputWitnesses(
  left: TtscBuildResult,
  right: TtscBuildResult,
  field: "hostInputHashes" | "hostInputRealpaths",
  inputs: readonly string[],
): Record<string, string | null> {
  const leftInputs = new Set(left.hostInputs);
  const rightInputs = new Set(right.hostInputs);
  const output: Record<string, string | null> = Object.create(null);
  for (const input of inputs) {
    const inLeft = leftInputs.has(input);
    const inRight = rightInputs.has(input);
    const leftKnown = Object.hasOwn(left[field] ?? {}, input);
    const rightKnown = Object.hasOwn(right[field] ?? {}, input);
    if (inLeft && inRight) {
      if (
        leftKnown &&
        rightKnown &&
        left[field]![input] === right[field]![input]
      )
        output[input] = left[field]![input]!;
    } else if (inLeft && leftKnown) output[input] = left[field]![input]!;
    else if (inRight && rightKnown) output[input] = right[field]![input]!;
  }
  return output;
}
