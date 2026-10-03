import assert from "node:assert/strict";
import fs from "node:fs";

import { pairE2eTraceWriterManifest, type TraceBoundaryRequirement } from "../../../internal/pairE2eTraceWriterManifest";
import type { TracePhaseObservation } from "../../../internal/captureE2eTracePhase";
import { requireE2eBaselinePreparation } from "../../../internal/requireE2eBaselinePreparation";
import { case_evidence_cold_prisma_population_controls_native_failure } from "./case_evidence_cold_prisma_population_controls_native_failure";
import { case_evidence_scaffold_hosts_activate_their_own_reference_failures } from "./case_evidence_scaffold_hosts_activate_their_own_reference_failures";

/**
 * Connects five authored transport profiles to one explicit producer selection.
 * This callable is not an index registration or a preparation owner. Caller
 * supplies the completed actual legacy measurement record and unchanged selected
 * producer observations before activating these shared-consumer callbacks.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs the two cold Prisma and three original scaffold-host callbacks using one supplied binary/assets/cache/trace selection, then pairs independently named boundary requirements with each actual returned native PID and phase rows.
 * @evidence contracts/testing.md#independent-expectations Five original profile labels and caller-authored event/data/producer requirements define the requested boundary population before execution. Actual trace rows do not generate requirements, baseline expectations or fixture-family counts.
 * @evidence contracts/testing.md#distinguishing-cases Rejects missing, failed-to-return or observation-incomplete legacy measurement; missing producer bytes/runtime/event boundaries cannot pass merely because semantic callbacks succeeded. A nonzero completed legacy verdict remains a measured failure, not converted to baseline success.
 * @evidence contracts/testing.md#execution-ownership Authored callable is unregistered and unexecuted. Caller owns the genuine legacy record, prepared installation/SDK/tool identity, five fresh slots, all descendant joins and scratch cleanup. This record guard is not cryptographic provenance or whole-population completeness certification.
 * @evidence contracts/e2e.md#necessary-boundary Joins the supported installed-consumer native checks and actual bridge observations with explicit selected producer assets. Portable T/G meaning owners remain separate; no fake host, DTO or new public product field stands in for transport.
 * @evidence contracts/e2e.md#shared-execution Passes one unchanged producer/cache/trace selection to both original profile groups and records five distinct native process/Program phases. It does not install/build, invoke the legacy runner, deduplicate PIDs or claim nine preparations achieved.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Requires actual completed legacy callback metadata before profile activation and unchanged selected producer hashes/native identities against that baseline. Existing profile callbacks use distinct fresh controlled slots and leave them for caller-owned joined cleanup; bounded trace/asset retention stays caller-owned.
 * @evidence contracts/e2e.md#preserved-coverage Keeps scaffold/first-model/three-inactive/function/H2 literal callbacks intact and names every resulting phase. Pairing reports observations only, never total upstream Programs, descendants or actual donor survival; original donors remain.
 */
export async function case_evidence_transport_profiles_share_explicit_preparation(input: {
  baseline: TracePhaseObservation<unknown>;
  cold: Parameters<typeof case_evidence_cold_prisma_population_controls_native_failure>[0];
  hostRoots: readonly [string, string, string];
  /** Current producer label to independently selected legacy producer label. */
  baselineProducerLabels: Readonly<Record<string, string>>;
  /** Five phase labels each own their explicit expected boundary criteria. */
  requirements: Readonly<Record<string, readonly Omit<TraceBoundaryRequirement, "writerPid">[]>>;
}): Promise<{
  phases: Awaited<ReturnType<typeof case_evidence_cold_prisma_population_controls_native_failure>>;
  pairing: ReturnType<typeof pairE2eTraceWriterManifest>[];
  completenessCertified: false;
}> {
  requireE2eBaselinePreparation(input.baseline, input.cold.traceRoot,
    input.cold.producerAssets, input.baselineProducerLabels);
  const labels = ["cold-prisma-scaffold", "cold-prisma-first-model", "scaffold-host-three-inactive-hosts",
    "scaffold-host-function-activates-reference", "scaffold-host-heading-activates-reference"];
  assert.deepEqual(Object.keys(input.requirements).sort(), [...labels].sort());
  for (const label of labels) assert.ok(input.requirements[label]!.length > 0, `named population ${label}`);
  assert.equal(new Set([input.cold.scaffoldRoot, input.cold.modelRoot, ...input.hostRoots]
    .map(root => fs.realpathSync.native(root))).size, 5, "five distinct controlled slots");
  const phases = [
    ...await case_evidence_cold_prisma_population_controls_native_failure(input.cold),
    ...await case_evidence_scaffold_hosts_activate_their_own_reference_failures({ ...input.cold, roots: input.hostRoots }),
  ];
  assert.deepEqual(phases.map(phase => phase.label), labels);
  const pairing = phases.map(phase => {
    assert.equal(phase.outcome.returned, true);
    if (!phase.outcome.returned) throw phase.outcome.error;
    for (const asset of input.cold.producerAssets) {
      const baselineLabel = input.baselineProducerLabels[asset.label]!;
      const prior = input.baseline.assetsAfter!.find(item => item.label === baselineLabel)!;
      const current = phase.assetsBefore.filter(item => item.label === asset.label);
      assert.equal(current.length, 1);
      assert.equal(current[0]!.requestedPath, prior.requestedPath);
      assert.equal(current[0]!.realPath, prior.realPath);
      assert.equal(current[0]!.sha256, prior.sha256);
      assert.deepEqual(current[0]!.identityBefore, prior.identityAfter);
    }
    const paired = pairE2eTraceWriterManifest(phase, input.requirements[phase.label]!.map(requirement => ({
      ...requirement, writerPid: phase.outcome.returned ? phase.outcome.value.pid : 0,
    })));
    assert.ok(paired.boundaries.length > 0);
    for (const boundary of paired.boundaries) assert.deepEqual(boundary.problems, [], boundary.boundary);
    return paired;
  });
  return { phases, pairing, completenessCertified: false };
}
