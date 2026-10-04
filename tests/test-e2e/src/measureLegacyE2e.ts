import fs from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";

import { E2eProcessTrace } from "../../utils/src/E2eProcessTrace";
import { captureE2eTracePhase, type TracePhaseInput, type TracePhaseObservation } from "./internal/captureE2eTracePhase";
import { compareE2ePhaseObservations } from "./internal/compareE2ePhaseObservations";
import { pairE2eTraceWriterManifest, type TraceBoundaryRequirement } from "./internal/pairE2eTraceWriterManifest";
import { pairE2eColdCommandArtifact } from "./internal/pairE2eColdCommandArtifact";
import { pairE2eCommandFileObservation } from "./internal/pairE2eCommandFileObservation";
import { requireE2eBaselinePreparation } from "./internal/requireE2eBaselinePreparation";
import { pairE2eInvocationOutcomes } from "./internal/pairE2eInvocationOutcomes";

/**
 * Runs either the legacy index or explicit consolidated families in one owned, instrumented Node process.
 * The default remains legacy measurement. --consolidated requires a retained actual legacy baseline and matching producer assets before selecting shared families. The fixed
 * external trace root must contain measurement-input.json with explicit assets,
 * cacheRoots and independently selected boundary requirements. Optional named
 * coldArtifacts requirements must follow the actual selected CLI population; they
 * bind build-owner rows to observed writer PIDs, not certified process ancestry.
 * A cold output is observed after its actual build, never prewarmed. Native writer admission may use an explicit observed event/domain discriminator and producer-asset requirement; it retains every matched actual writer PID and does not certify ancestry or expected child totals. Producer/tool
 * paths are supplied by the prepared manifest, never resolved by a version probe.
 *
 * The final report is observed-only. This process close joins the runner's own
 * inherited stdio contract, not arbitrary descendants or unobserved producers.
 * File/cache/report observation overhead is disclosed separately from the timed
 * runner callback. The same entry and fixed root apply to before/after runs.
 *
 * @evidence contracts/common.md#principled-implementation Launches the actual legacy index through one owned child and preserves its CLI filters, package cwd, environment and inherited output. Actual close/status/error plus independently supplied writer requirements remain distinct from certified population completeness.
 * @evidence contracts/common.md#clear-and-simple-design One explicit coordinator input connects preparation observations, the unchanged legacy runner, actual boundary pairing and one retained report without changing package scripts or product configuration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not warm a producer before timing, discover guessed executable paths, infer descendants from parent close or convert static boundary counts to actual process totals.
 * @evidence contracts/common.md#meaningful-documentation States external preparation input, fixed opt-in root, legacy selection preservation, observation overhead and remaining join/completeness limitations.
 * @evidence contracts/portability.md#os-neutral-implementation Uses the actual coordinator Node executable and explicit absolute loader/entry paths, native cwd and unchanged caller environment. Returned status/signal/error remain distinct without OS-name interpretation.
 * @evidence contracts/performance.md#efficient-algorithms Launches one runner and encodes one actual metadata report; capture/pairing costs follow explicit asset bytes, cache entries and trace rows. Report serialization allocates its complete text before its256MiB admission check.
 * @evidence contracts/performance.md#reuse-equivalent-work The default preserves baseline preparations; consolidated mode selects explicit shared-family owners only after retained writer, cold-artifact, command-file and actual invocation pairings have no recorded problems and current producer identity matches the baseline. It uses the observed sequence cursor without converting nonzero baseline semantic outcomes to PASS or certifying whole-population coverage.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Awaits the owned runner close before reading trace/report data; report writes close synchronously. Unknown descendants remain uncertified and the external root is retained, never recursively cleaned by this entry.
 */
export async function measureLegacyE2e(): Promise<void> {
  const consolidated = process.argv.includes("--consolidated");
  let retainedBaselinePhase: TracePhaseObservation<unknown> | undefined;
  const traceRoot = process.env.TTSC_E2E_TRACE;
  if (!traceRoot || !path.isAbsolute(traceRoot))
    throw new Error("Legacy measurement requires the fixed absolute TTSC_E2E_TRACE root");
  const inputFile = path.join(traceRoot, "measurement-input.json");
  const input = JSON.parse(fs.readFileSync(inputFile, "utf8")) as {
    assets: TracePhaseInput["assets"];
    cacheRoots: string[];
    afterSequences?: Record<string, number>;
    boundaries: (Omit<TraceBoundaryRequirement, "writerPid"> & { writerPid: number | "coordinator" | "runner" | "observed" })[];
    coldArtifacts?: (Omit<Parameters<typeof pairE2eColdCommandArtifact>[1], "writerPid"> & { boundary: string })[];
    commandFiles?: (Omit<Parameters<typeof pairE2eCommandFileObservation>[1], "writerPid"> & { boundary: string })[];
    baselineReport?: string;
    producerLabels?: Record<string, string>;
  };
  if (!Array.isArray(input.assets) || !Array.isArray(input.cacheRoots) || !Array.isArray(input.boundaries) || input.boundaries.length === 0)
    throw new Error("Measurement input requires explicit asset/cache/boundary arrays");
  for (const boundary of input.boundaries) {
    if (boundary.writerPid !== "observed") continue;
    if (!boundary.data || typeof boundary.data !== "object" ||
      Array.isArray(boundary.data) || Object.keys(boundary.data).length === 0 ||
      !Array.isArray(boundary.producerAssets) || boundary.producerAssets.length === 0)
      throw new Error("Observed writer admission requires explicit domain/primitive and producer-asset requirements");
    for (const value of Object.values(boundary.data))
      if (value !== null && !["string", "number", "boolean"].includes(typeof value))
        throw new Error("Observed writer discriminator must contain scalar values");
  }
  if (consolidated) {
    if (!input.baselineReport || !path.isAbsolute(input.baselineReport) ||
      !input.producerLabels || typeof input.producerLabels !== "object")
      throw new Error("Consolidated measurement requires an actual baseline report and producer-label correspondence");
    const baseline = JSON.parse(fs.readFileSync(input.baselineReport, "utf8")) as {
      phase: Parameters<typeof requireE2eBaselinePreparation>[0];
      pairing: ReturnType<typeof pairE2eTraceWriterManifest>;
      coldArtifacts: {
        problems: string[];
        writers: { pairing: ReturnType<typeof pairE2eColdCommandArtifact> }[];
      }[];
      commandFiles: {
        problems: string[];
        writers: { pairing: ReturnType<typeof pairE2eCommandFileObservation> }[];
      }[];
      invocations: ReturnType<typeof pairE2eInvocationOutcomes>;
    };
    // Completed runner metadata alone does not admit an incomplete measurement.
    // Semantic failure remains a measured failure, not a fabricated baseline PASS.
    assert.ok(baseline.pairing && Array.isArray(baseline.pairing.boundaries));
    assert.ok(baseline.pairing.boundaries.length > 0);
    for (const boundary of baseline.pairing.boundaries)
      assert.deepEqual(boundary.problems, []);
    assert.ok(Array.isArray(baseline.coldArtifacts));
    for (const boundary of baseline.coldArtifacts) {
      assert.deepEqual(boundary.problems, []);
      assert.ok(Array.isArray(boundary.writers));
      for (const writer of boundary.writers) {
        assert.deepEqual(writer.pairing.problems, []);
        assert.ok(Array.isArray(writer.pairing.artifacts));
        for (const artifact of writer.pairing.artifacts)
          assert.deepEqual(artifact.problems, []);
      }
    }
    assert.ok(Array.isArray(baseline.commandFiles));
    for (const boundary of baseline.commandFiles) {
      assert.deepEqual(boundary.problems, []);
      assert.ok(Array.isArray(boundary.writers));
      for (const writer of boundary.writers)
        assert.deepEqual(writer.pairing.problems, []);
    }
    assert.ok(baseline.invocations && Array.isArray(baseline.invocations.invocations));
    assert.deepEqual(baseline.invocations.problems, []);
    let observedTest = false;
    for (const invocation of baseline.invocations.invocations)
      if (invocation.kind === "test") observedTest = true;
    assert.ok(observedTest, "Baseline lacks an actual selected test invocation");
    requireE2eBaselinePreparation(
      baseline.phase,
      traceRoot,
      input.assets,
      input.producerLabels,
    );
    // Use the actual completed baseline cursor, never an authored event count.
    input.afterSequences = { ...baseline.phase.traces!.lastWriterSequences };
    retainedBaselinePhase = baseline.phase;
  }
  if (input.coldArtifacts !== undefined && !Array.isArray(input.coldArtifacts))
    throw new Error("Cold artifact requirements must be an explicitly selected array");
  const coldNames = new Set<string>();
  for (const requirement of input.coldArtifacts ?? []) {
    if (!requirement || typeof requirement.boundary !== "string" || !requirement.boundary ||
      coldNames.has(requirement.boundary) || typeof requirement.buildOwner !== "string" || !requirement.buildOwner ||
      typeof requirement.useOwner !== "string" || !requirement.useOwner ||
      typeof requirement.rawLabel !== "string" || !/^[a-z0-9-]+$/i.test(requirement.rawLabel) ||
      !Number.isSafeInteger(requirement.minimumUses) || requirement.minimumUses < 1 ||
      ![requirement.buildPrefix, requirement.buildSuffix, requirement.usePrefix, requirement.producerAssets]
        .every(values => Array.isArray(values) && values.every(value => typeof value === "string")) ||
      (requirement.useArguments !== undefined &&
        (!Array.isArray(requirement.useArguments) || requirement.useArguments.some(value => typeof value !== "string"))) ||
      requirement.producerAssets.length === 0)
      throw new Error("Invalid or duplicate independently selected cold artifact requirement");
    coldNames.add(requirement.boundary);
  }
  if (input.commandFiles !== undefined && !Array.isArray(input.commandFiles))
    throw new Error("Command file requirements must be an explicitly selected array");
  const commandNames = new Set<string>();
  for (const requirement of input.commandFiles ?? []) {
    if (!requirement || typeof requirement.boundary !== "string" || !requirement.boundary ||
      commandNames.has(requirement.boundary) ||
      !["native-artifact", "selected-file-observation"].includes(requirement.event) ||
      (requirement.owner !== undefined && typeof requirement.owner !== "string") ||
      typeof requirement.producerAsset !== "string" || !requirement.producerAsset ||
      !Number.isSafeInteger(requirement.minimumCalls) || requirement.minimumCalls < 1)
      throw new Error("Invalid or duplicate independently selected command file requirement");
    commandNames.add(requirement.boundary);
  }
  const entry = fileURLToPath(new URL("./legacyE2eTraceEntry.ts", import.meta.url));
  const index = fileURLToPath(new URL(consolidated ? "./consolidatedE2eIndex.ts" : "./index.ts", import.meta.url));
  const loader = fileURLToPath(new URL("../../../config/register-typescript-loader.mjs", import.meta.url));
  const cwd = fileURLToPath(new URL("../", import.meta.url));
  const requiredWriterPids = [process.pid];
  let runnerPid: number | undefined;
  const phase = await captureE2eTracePhase({
    label: consolidated ? "consolidated" : "legacy-baseline", traceRoot, cacheRoots: input.cacheRoots,
    requiredWriterPids, afterSequences: input.afterSequences,
    assets: [
      ...input.assets,
      { label: "measurement-node", role: "executable", file: process.execPath },
      { label: "measurement-runtime", role: "instrumentation-source", file: E2eProcessTrace.runtimePath },
      { label: "measurement-entry", role: "instrumentation-source", file: entry },
      { label: "measurement-index", role: "loaded-module", file: index },
      { label: "measurement-loader", role: "loaded-module", file: loader },
      { label: "measurement-input", role: "configuration", file: inputFile },
    ],
  }, async () => {
    const child = E2eProcessTrace.spawn(process.execPath, [
      "--disable-warning=ExperimentalWarning", "--experimental-strip-types", "--import", loader,
      entry, ...process.argv.slice(2),
    ], { cwd, env: process.env, stdio: "inherit" });
    if (child.pid !== undefined && child.pid > 0) {
      runnerPid = child.pid;
      requiredWriterPids.push(child.pid);
    }
    return await new Promise<{ pid: number | null; status: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      let spawnError: Error | undefined;
      child.once("error", error => { spawnError = error; });
      child.once("close", (status, signal) => {
        if (spawnError) reject(spawnError);
        else resolve({ pid: child.pid ?? null, status, signal });
      });
    });
  });
  const observedRequirements: TraceBoundaryRequirement[] = [];
  for (const boundary of input.boundaries) {
    if (boundary.writerPid !== "observed") {
      observedRequirements.push({
        ...boundary,
        writerPid: boundary.writerPid === "coordinator" ? process.pid :
          boundary.writerPid === "runner" ? runnerPid ?? 0 : boundary.writerPid,
      });
      continue;
    }
    const actualWriterPids = new Set<number>();
    for (const row of phase.traces?.writerObservations ?? []) {
      if (row.observation.event !== boundary.event) continue;
      let matches = true;
      for (const [key, value] of Object.entries(boundary.data!))
        if (row.observation.data?.[key] !== value) matches = false;
      if (matches) actualWriterPids.add(row.observation.writerPid);
    }
    if (actualWriterPids.size === 0)
      observedRequirements.push({ ...boundary, writerPid: 0 });
    else
      for (const writerPid of actualWriterPids)
        observedRequirements.push({ ...boundary, writerPid });
  }
  const pairing = pairE2eTraceWriterManifest(phase, observedRequirements);
  const coldArtifacts = (input.coldArtifacts ?? []).map(requirement => {
    const actualWriterPids = new Set((phase.traces?.writerObservations ?? [])
      .filter(row => row.observation.event === "native-artifact" &&
        row.observation.data?.owner === requirement.buildOwner)
      .map(row => row.observation.writerPid));
    return {
      boundary: requirement.boundary,
      writerAdmission: "observed-artifact-owner-not-ancestry-certified",
      problems: actualWriterPids.size ? [] : ["Missing explicitly required cold artifact writer"],
      writers: [...actualWriterPids].map(writerPid => ({ writerPid,
        pairing: pairE2eColdCommandArtifact(phase, { ...requirement, writerPid }) })),
    };
  });
  const commandFiles = (input.commandFiles ?? []).map(requirement => {
    const prepared = phase.assetsBefore.find(asset => asset.label === requirement.producerAsset);
    const actualWriterPids = new Set((phase.traces?.writerObservations ?? [])
      .filter(row => row.observation.event === requirement.event &&
        (requirement.owner === undefined || row.observation.data?.owner === requirement.owner) && prepared &&
        (row.observation.data?.realPath === prepared.realPath ||
          row.observation.data?.requestedPath === prepared.requestedPath))
      .map(row => row.observation.writerPid));
    return {
      boundary: requirement.boundary,
      writerAdmission: "observed-command-file-not-ancestry-certified",
      problems: actualWriterPids.size ? [] : ["Missing explicitly required command file writer"],
      writers: [...actualWriterPids].map(writerPid => ({ writerPid,
        pairing: pairE2eCommandFileObservation(phase, { ...requirement, writerPid }) })),
    };
  });
  const invocations = pairE2eInvocationOutcomes(phase.traces);
  const comparison = retainedBaselinePhase && phase.traces
    ? compareE2ePhaseObservations(retainedBaselinePhase, phase)
    : undefined;
  const report = JSON.stringify({ phase, pairing, coldArtifacts, commandFiles, invocations, comparison, descendantJoinCertified: false }, (_key, value) =>
    value instanceof Error ? { name: value.name, message: value.message, stack: value.stack,
      diagnostic: inspect(value, { depth: null, customInspect: false, getters: false,
        maxArrayLength: null, maxStringLength: null }) } : value, 2);
  if (Buffer.byteLength(report) > 256 * 1024 * 1024)
    throw new Error("Legacy measurement report exceeds coordinator observation limit");
  fs.writeFileSync(path.join(traceRoot, `${consolidated ? "consolidated" : "legacy"}-report-${process.pid}.json`), report + "\n", { flag: "wx" });
  if (!phase.outcome.returned || phase.outcome.value.status === null || phase.outcome.value.signal !== null ||
    phase.observationErrors.length !== 0 || phase.traces?.integrityProblems.length !== 0 ||
    phase.traces?.incompleteProcessInvocations.length !== 0 ||
    invocations.problems.length !== 0 || pairing.boundaries.some(boundary => boundary.problems.length !== 0) ||
    coldArtifacts.some(boundary => boundary.problems.length !== 0 || boundary.writers.some(writer =>
      writer.pairing.problems.length !== 0 || writer.pairing.artifacts.some(artifact => artifact.problems.length !== 0))) ||
    commandFiles.some(boundary => boundary.problems.length !== 0 ||
      boundary.writers.some(writer => writer.pairing.problems.length !== 0))) process.exitCode = 1;
  else process.exitCode = phase.outcome.value.status;
}

await measureLegacyE2e();
