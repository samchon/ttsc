import assert from "node:assert/strict";

import type { TracePhaseObservation } from "../../internal/captureE2eTracePhase";
import { pairE2eTraceWriterManifest, type TraceBoundaryRequirement } from "../../internal/pairE2eTraceWriterManifest";
import { requireE2eBaselinePreparation } from "../../internal/requireE2eBaselinePreparation";
import { case_lint_executable_configs_preserve_pattern_precedence } from "./case_lint_executable_configs_preserve_pattern_precedence";
import { case_lint_native_format_preserves_the_live_buffer_boundary } from "./case_lint_native_format_preserves_the_live_buffer_boundary";

/**
 * Connects ordered-loader and live-buffer profiles to common preparation.
 * Caller owns the actual legacy record, original formatting selection and the
 * prepared installed sidecar. This callable creates no installation and is not
 * wired into the current index; real baseline precedes later activation.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs existing CJS/TS ordered native fixes and dirty/clean native stdin formatting, then pairs four independently named phase manifests with their actual process or owning spawn writer PIDs.
 * @evidence contracts/testing.md#independent-expectations Exact four labels and independently supplied expected boundary criteria precede execution. Original callback literals retain first/untouched, URI/edit/null and unchanged disk rather than deriving output from trace or pairing.
 * @evidence contracts/testing.md#distinguishing-cases Ordered phases require real native loader writer observations, whereas source-only format phases require the owning spawn observer and do not assume a Go trace file. Missing runtime/producer/event observations are failure, not a fabricated child or native writer.
 * @evidence contracts/testing.md#execution-ownership Callable is unregistered/unexecuted. Caller owns authentic baseline, prepared binary/SDK/config identities, original format input and joined cleanup. Each callback result and source observation remains separate from actual whole-population completeness and donor survival.
 * @evidence contracts/e2e.md#necessary-boundary Installed config evaluation/result-file/native fix and actual stdin/WorkspaceEdit transport retain distinct joined defects that direct rule or normalization units do not certify.
 * @evidence contracts/e2e.md#shared-execution One selected binary/producer/cache/trace population is passed to both groups; four actual direct processes and any associated Programs are retained as distinct observations. Config/source reset is owned by the ordered callback before formatting starts, without rebuilding or reinstalling.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Requires same-root legacy baseline and unchanged producer observations before each group. Ordered callback restores its controlled inputs before returning and blocks reset on uncertain ownership; format callback is read-only except stdin. Native direct-child return and writer pairing do not certify arbitrary descendant termination.
 * @evidence contracts/e2e.md#preserved-coverage Existing original ordered-options and live-buffer literals remain in their owning callbacks. Additional loader graph/ABA/resident profiles remain separately pending; original donors, indexes and scripts are untouched until actual baseline/activation/survival gates.
 */
export async function case_lint_transport_profiles_share_explicit_preparation(input: {
  baseline: TracePhaseObservation<unknown>;
  directory: string;
  binary: string;
  observation: Parameters<typeof case_lint_executable_configs_preserve_pattern_precedence>[2];
  format: Pick<Parameters<typeof case_lint_native_format_preserves_the_live_buffer_boundary>[0],
    "directory" | "file" | "tsconfig" | "pluginsJSON">;
  baselineProducerLabels: Readonly<Record<string, string>>;
  requirements: Readonly<Record<string, readonly Omit<TraceBoundaryRequirement, "writerPid">[]>>;
}): Promise<{ phases: Awaited<ReturnType<typeof case_lint_executable_configs_preserve_pattern_precedence>>;
  pairing: ReturnType<typeof pairE2eTraceWriterManifest>[]; completenessCertified: false }> {
  const labels = ["ordered-loader-lint.config.cjs", "ordered-loader-lint.config.ts", "format-dirty-buffer", "format-clean-buffer"];
  assert.deepEqual(Object.keys(input.requirements).sort(), [...labels].sort());
  for (const label of labels) assert.ok(input.requirements[label]!.length > 0, `named population ${label}`);
  requireE2eBaselinePreparation(input.baseline, input.observation.traceRoot,
    input.observation.producerAssets, input.baselineProducerLabels);
  const ordered = await case_lint_executable_configs_preserve_pattern_precedence(input.directory, input.binary, input.observation);
  requireE2eBaselinePreparation(input.baseline, input.observation.traceRoot,
    input.observation.producerAssets, input.baselineProducerLabels);
  const format = await case_lint_native_format_preserves_the_live_buffer_boundary({ ...input.format,
    binary: input.binary, traceRoot: input.observation.traceRoot,
    producerAssets: input.observation.producerAssets, cacheRoots: input.observation.cacheRoots });
  const phases = [...ordered, ...format];
  assert.deepEqual(phases.map(phase => phase.label), labels);
  const pairing = phases.map(phase => {
    assert.equal(phase.outcome.returned, true);
    if (!phase.outcome.returned) throw phase.outcome.error;
    const paired = pairE2eTraceWriterManifest(phase, input.requirements[phase.label]!.map(requirement => ({
      ...requirement,
      writerPid: phase.label.startsWith("ordered-loader-") ?
        (phase.outcome.returned ? phase.outcome.value.pid : 0) : process.pid,
    })));
    for (const boundary of paired.boundaries) assert.deepEqual(boundary.problems, [], boundary.boundary);
    return paired;
  });
  return { phases, pairing, completenessCertified: false };
}
