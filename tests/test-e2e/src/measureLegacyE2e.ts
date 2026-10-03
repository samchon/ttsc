import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";

import { E2eProcessTrace } from "../../utils/src/E2eProcessTrace";
import { captureE2eTracePhase, type TracePhaseInput } from "./internal/captureE2eTracePhase";
import { pairE2eTraceWriterManifest, type TraceBoundaryRequirement } from "./internal/pairE2eTraceWriterManifest";

/**
 * Runs the unchanged legacy index in one owned, instrumented Node process.
 * This is a measurement entry, not an activated consolidation runner. The fixed
 * external trace root must contain measurement-input.json with explicit assets,
 * cacheRoots and independently selected boundary requirements. Producer/tool
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
 * @evidence contracts/performance.md#reuse-equivalent-work The original runner retains its existing preparations and assertions for baseline measurement; this coordinator does not consolidate, prewarm or reuse another run's outcomes.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Awaits the owned runner close before reading trace/report data; report writes close synchronously. Unknown descendants remain uncertified and the external root is retained, never recursively cleaned by this entry.
 */
export async function measureLegacyE2e(): Promise<void> {
  const traceRoot = process.env.TTSC_E2E_TRACE;
  if (!traceRoot || !path.isAbsolute(traceRoot))
    throw new Error("Legacy measurement requires the fixed absolute TTSC_E2E_TRACE root");
  const inputFile = path.join(traceRoot, "measurement-input.json");
  const input = JSON.parse(fs.readFileSync(inputFile, "utf8")) as {
    assets: TracePhaseInput["assets"];
    cacheRoots: string[];
    afterSequences?: Record<string, number>;
    boundaries: (Omit<TraceBoundaryRequirement, "writerPid"> & { writerPid: number | "coordinator" | "runner" })[];
  };
  if (!Array.isArray(input.assets) || !Array.isArray(input.cacheRoots) || !Array.isArray(input.boundaries) || input.boundaries.length === 0)
    throw new Error("Measurement input requires explicit asset/cache/boundary arrays");
  const entry = fileURLToPath(new URL("./legacyE2eTraceEntry.ts", import.meta.url));
  const index = fileURLToPath(new URL("./index.ts", import.meta.url));
  const loader = fileURLToPath(new URL("../../../config/register-typescript-loader.mjs", import.meta.url));
  const cwd = fileURLToPath(new URL("../", import.meta.url));
  const requiredWriterPids = [process.pid];
  let runnerPid: number | undefined;
  const phase = await captureE2eTracePhase({
    label: "legacy-baseline", traceRoot, cacheRoots: input.cacheRoots,
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
  const pairing = pairE2eTraceWriterManifest(phase, input.boundaries.map(boundary => ({
    ...boundary,
    writerPid: boundary.writerPid === "coordinator" ? process.pid :
      boundary.writerPid === "runner" ? runnerPid ?? 0 : boundary.writerPid,
  })));
  const report = JSON.stringify({ phase, pairing, descendantJoinCertified: false }, (_key, value) =>
    value instanceof Error ? { name: value.name, message: value.message, stack: value.stack,
      diagnostic: inspect(value, { depth: null, customInspect: false, getters: false,
        maxArrayLength: null, maxStringLength: null }) } : value, 2);
  if (Buffer.byteLength(report) > 256 * 1024 * 1024)
    throw new Error("Legacy measurement report exceeds coordinator observation limit");
  fs.writeFileSync(path.join(traceRoot, `legacy-report-${process.pid}.json`), report + "\n", { flag: "wx" });
  if (!phase.outcome.returned || phase.outcome.value.status === null || phase.outcome.value.signal !== null ||
    phase.observationErrors.length !== 0 || phase.traces?.integrityProblems.length !== 0 ||
    phase.traces?.incompleteProcessInvocations.length !== 0 ||
    pairing.boundaries.some(boundary => boundary.problems.length !== 0)) process.exitCode = 1;
  else process.exitCode = phase.outcome.value.status;
}

await measureLegacyE2e();
