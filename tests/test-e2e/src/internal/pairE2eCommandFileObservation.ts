import crypto from "node:crypto";
import type { TracePhaseObservation } from "./captureE2eTracePhase";
import { readE2eTracePayload } from "./readE2eTracePayload";

/**
 * Binds a before-call file observation and synchronous command result to an
 * independently prepared executable. Async child close remains a separate owner.
 * Go retained artifacts and test-owned direct-file hashes have different native
 * identity fields; neither is treated as an OS-loaded-image certificate.
 *
 * @evidence contracts/common.md#principled-implementation Pairs the same actual writer/invocation file observation and later process attempt/result with independently prepared executable path/hash observations, preserving failures and missing metadata as problems.
 * @evidence contracts/common.md#clear-and-simple-design Handles the two authored before-call observation forms explicitly and leaves source/command semantic assertions to their consuming profiles.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not resolve guessed PATH executables, infer actual process counts from requirements, fabricate byte captures or certify image loading, ancestry or descendant joins.
 * @evidence contracts/common.md#meaningful-documentation States the independent preparation source, distinct observer forms, actual invocation ordering and limits of recorded file/hash equality.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Compares existing native file/process observations without OS-name assumptions or path case folding; retained-byte IO is delegated to the payload reader.
 * @evidence contracts/performance.md#efficient-algorithms Filters phase rows and checks matching invocations, reading each Go capture at most once with its64MiB bound. TS selected-file observations reuse their recorded hash and require no executable reread.
 * @evidence contracts/performance.md#reuse-equivalent-work Uses this phase's actual prepared assets and events only; no earlier command result or another writer's file evidence substitutes for a missing observation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Payload readers close descriptors before return; local byte buffers become collectible after hashing. Named metadata transfers to the caller; trace-root and process joins remain coordinator-owned.
 */
export function pairE2eCommandFileObservation(
  phase: TracePhaseObservation<unknown>,
  input: { writerPid: number; event: "native-artifact" | "selected-file-observation";
    owner?: string; producerAsset: string; minimumCalls: number },
): { invocations: string[]; problems: string[]; completenessCertified: false } {
  if (!Number.isSafeInteger(input.writerPid) || input.writerPid <= 0 ||
    !Number.isSafeInteger(input.minimumCalls) || input.minimumCalls < 1)
    throw new Error("Command file pairing requires actual writer PID and explicit positive call requirement");
  const problems: string[] = [];
  const before = phase.assetsBefore.find(asset => asset.label === input.producerAsset);
  const after = phase.assetsAfter?.find(asset => asset.label === input.producerAsset);
  if (!before || !after || before.requestedPath !== after.requestedPath || before.realPath !== after.realPath ||
    before.sha256 !== after.sha256 || JSON.stringify(before.identityAfter) !== JSON.stringify(after.identityBefore))
    problems.push("Missing or changing independently prepared executable file");
  if (!phase.traces || phase.observationErrors.length || phase.traces.integrityProblems.length ||
    phase.traces.incompleteProcessInvocations.length)
    problems.push("Phase has incomplete or failed observations");
  const rows = (phase.traces?.writerObservations ?? [])
    .filter(row => row.observation.writerPid === input.writerPid);
  const invocations: string[] = [];
  for (const row of rows) {
    const event = row.observation;
    const data = event.data ?? {};
    if (event.event !== input.event || (input.owner !== undefined && data.owner !== input.owner)) continue;
    const sameCall = rows.filter(candidate => candidate.writerFile === row.writerFile &&
      candidate.observation.invocation === event.invocation);
    const attempt = sameCall.find(candidate => candidate.observation.event === "process-attempt");
    const result = sameCall.find(candidate => candidate.observation.event === "process-result");
    if (data.outcome !== "complete" || !before || data.realPath !== before.realPath || data.sha256 !== before.sha256)
      problems.push("Selected command file does not match its independent preparation: " + event.invocation);
    if (!phase.traces?.writerRuntimeVersions[row.writerFile])
      problems.push("Missing actual command observer runtime: " + row.writerFile);
    if (input.event === "native-artifact") {
      if (data.sameHandleIdentity !== true || data.samePathIdentity !== true || data.metadataUnchanged !== true ||
        data.realPathAfter !== data.realPath || !data.identityBefore || !data.identityAfter ||
        JSON.stringify(data.identityBefore) !== JSON.stringify(data.identityAfter))
        problems.push("Unstable native command artifact identity: " + event.invocation);
      try {
        const captured = readE2eTracePayload(phase.traceRoot, event, data.raw);
        if (captured.bytes.length !== data.observedBytes ||
          crypto.createHash("sha256").update(captured.bytes).digest("hex") !== data.sha256)
          problems.push("Retained command bytes/hash differ: " + event.invocation);
      } catch (error) { problems.push("Missing command artifact bytes: " + String(error)); }
    } else if (!data.identityBefore || !data.identityAfter || !data.identityAtPathAfter ||
      JSON.stringify(data.identityBefore) !== JSON.stringify(data.identityAfter) ||
      JSON.stringify(data.identityAfter) !== JSON.stringify(data.identityAtPathAfter)) {
      problems.push("Unstable test-owned selected file identity: " + event.invocation);
    }
    const resultData = result?.observation.data ?? {};
    const actualStarted = result?.observation.started ?? resultData.started;
    const actualExitObserved = result?.observation.exitObserved ?? resultData.exitObserved;
    const resultFields = result?.observation as (typeof event & { status?: number | null; signal?: string | null; error?: unknown });
    const successful = input.event === "native-artifact"
      ? resultData.success === true && resultData.exitCode === 0
      : resultFields?.status === 0 && resultFields.signal === null && resultFields.error === undefined;
    const selectedPath = attempt?.observation.data?.selectedPath;
    const requestedArgv = (attempt?.observation as (typeof event & { argv?: unknown[] }))?.argv;
    const selectedCommand = input.event === "native-artifact" ? selectedPath : requestedArgv?.[0];
    if (!attempt || !result || event.sequence >= attempt.observation.sequence ||
      attempt.observation.sequence >= result.observation.sequence ||
      selectedCommand !== data.requestedPath || actualStarted !== true || actualExitObserved !== true ||
      !(Number(result.observation.pid) > 0) || !successful)
      problems.push("Missing later successful actual command for file observation: " + event.invocation);
    else invocations.push(event.invocation);
  }
  if (new Set(invocations).size < input.minimumCalls)
    problems.push("Missing explicitly required before-call file connections");
  return { invocations, problems, completenessCertified: false };
}
