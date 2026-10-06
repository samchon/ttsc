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
    graph: mergeCheckGraphs(left.graph, right.graph),
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
 * Preserve each phase's source closure and refuse contradictory witnesses.
 *
 * @evidence contracts/common.md#principled-implementation Unioned memberships retain every producer's source authority; conflicting content, physical and predicate observations leave an explicit proof failure instead of selecting a later witness.
 * @evidence contracts/common.md#clear-and-simple-design One graph combiner serves check composition and the later transform phase without reading inputs or creating a Program.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Reported omissions remain omissions; incompatible witnesses cannot be replaced by current filesystem observations.
 * @evidence contracts/common.md#meaningful-documentation The native description states phase composition and the unresolved-witness behavior without claiming execution acceptance.
 * @evidence contracts/performance.md#efficient-algorithms Each graph map and list is visited to union memberships and compare overlapping witnesses. Set membership avoids list cross-products; JSON comparison still visits overlapping predicate/value bytes and allocates comparison strings. Temporary maps, lists and Sets follow both graph populations, without a size ceiling here.
 * @evidence contracts/performance.md#reuse-equivalent-work The combiner preserves supplied generation authority and compares overlapping witnesses; it retains no prior merged verdict and performs no input observation. A merged graph does not authorize reuse until the consuming generation validates every preserved witness and failure.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Union maps, arrays, Sets and comparison strings are call-owned and the returned graph transfers to its caller. Inputs remain borrowed, and no historical graph population, native handle or background task is retained here; payload size is not capped.
 * @evidence contracts/portability.md#os-neutral-implementation Compiler-reported graph coordinates and physical witnesses pass through unchanged. Case policy is retained only when both reports agree, and incompatible explicit policies leave proof failures; this combiner performs no native path lookup, separator rewriting or OS-name inference.
 */
export function mergeCheckGraphs(
  left: TtscBuildResult["graph"],
  right: TtscBuildResult["graph"],
): TtscBuildResult["graph"] {
  if (left === undefined) return right;
  if (right === undefined) return left;
  const failures = { ...left.inputProofFailures, ...right.inputProofFailures };
  if (left.useCaseSensitiveFileNames !== undefined &&
    right.useCaseSensitiveFileNames !== undefined &&
    left.useCaseSensitiveFileNames !== right.useCaseSensitiveFileNames)
    for (const key of new Set([...Object.keys(left.edges), ...Object.keys(right.edges)]))
      failures[key] = "conflicting-check-case-policy";
  const mergeLists = (a: Record<string, string[]> = {}, b: Record<string, string[]> = {}) =>
    Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])]
      .map((key) => [key, [...new Set([...(a[key] ?? []), ...(b[key] ?? [])])]]));
  const mergeProofs = <T>(a: Record<string, T> = {}, b: Record<string, T> = {}): Record<string, T> => {
    const merged = { ...a, ...b };
    for (const key of Object.keys(a))
      if (Object.hasOwn(b, key) && JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
        delete merged[key];
        failures[key] = "conflicting-check-generations";
      }
    return merged;
  };
  const observations = { ...left.inputObservations, ...right.inputObservations };
  for (const key of Object.keys(left.inputObservations ?? {})) {
    const a = left.inputObservations![key]!;
    const b = right.inputObservations?.[key];
    if (b === undefined) continue;
    const merged = { ...a, ...b };
    for (const field of Object.keys(a) as (keyof typeof a)[]) {
      if (field === "nativePredicates") continue;
      if (Object.hasOwn(b, field) && JSON.stringify(a[field]) !== JSON.stringify(b[field]))
        failures[key] = "conflicting-check-generations";
    }
    if (a.nativePredicates !== undefined || b.nativePredicates !== undefined) {
      const predicates = new Map<string, NonNullable<typeof a.nativePredicates>[number]>();
      const witnesses = new Map<string, string>();
      for (const predicate of [...(a.nativePredicates ?? []), ...(b.nativePredicates ?? [])]) {
        const { scope, ...witness } = predicate;
        const serialized = JSON.stringify(witness);
        const prior = witnesses.get(predicate.kind);
        if (prior !== undefined && prior !== serialized) failures[key] = "conflicting-check-generations";
        witnesses.set(predicate.kind, serialized);
        predicates.set(`${predicate.kind}:${scope}`, predicate);
      }
      merged.nativePredicates = [...predicates.values()].sort((a, b) => `${a.kind}:${a.scope}`.localeCompare(`${b.kind}:${b.scope}`));
    }
    observations[key] = merged;
  }
  return {
    edges: mergeLists(left.edges, right.edges),
    globals: [...new Set([...left.globals, ...right.globals])],
    configs: [...new Set([...left.configs, ...right.configs])],
    candidates: mergeLists(left.candidates, right.candidates),
    resolutionInputs: [...new Set([...(left.resolutionInputs ?? []), ...(right.resolutionInputs ?? [])])],
    inputHashes: mergeProofs(left.inputHashes, right.inputHashes),
    inputRealpaths: mergeProofs(left.inputRealpaths, right.inputRealpaths),
    inputObservations: observations,
    inputProofFailures: failures,
    ...(left.useCaseSensitiveFileNames === right.useCaseSensitiveFileNames
      ? { useCaseSensitiveFileNames: left.useCaseSensitiveFileNames }
      : {}),
  };
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
