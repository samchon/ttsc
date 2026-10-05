import crypto from "node:crypto";

import type { TracePhaseObservation } from "./captureE2eTracePhase";
import { readE2eTracePayload } from "./readE2eTracePayload";

/**
 * Binds a before-call file observation and synchronous result or actual async
 * start/exit/close to an independently prepared executable. Close certifies
 * only this direct child's stdio boundary, not arbitrary descendant
 * termination. Actual start/termination binds the file even for an expected
 * negative exit; each consuming profile separately owns its status/error
 * expectation. Go retained artifacts and explicitly identified native streamed
 * hashes share native identity fields. TS direct-file hashes retain their own
 * identity shape; none is treated as an OS-loaded-image certificate.
 *
 * @evidence contracts/common.md#principled-implementation Pairs the same actual writer/invocation file observation and later process attempt/result with independently prepared executable path/hash observations, preserving missing lifecycle metadata as problems while leaving product success, negative exits and errors to their consuming profile assertions.
 * @evidence contracts/common.md#clear-and-simple-design Separates retained native bytes, explicitly identified native streamed hashes and TS file hashes, leaving source/command semantic assertions to their consuming profiles.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not resolve guessed PATH executables, infer actual process counts from requirements, fabricate byte captures or certify image loading, ancestry or descendant joins.
 * @evidence contracts/common.md#meaningful-documentation States the independent preparation source, distinct observer forms, actual invocation ordering and limits of recorded file/hash equality.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Compares existing native file/process observations without OS-name assumptions or path case folding; retained-byte IO is delegated to the payload reader.
 * @evidence contracts/performance.md#efficient-algorithms Filters phase rows and checks matching invocations, reading each retained Go capture at most once with its 64MiB bound. Streamed native and TS selected-file observations reuse their recorded hash without rereading the executable.
 * @evidence contracts/performance.md#reuse-equivalent-work Uses this phase's actual prepared assets and events only; no earlier command result or another writer's file evidence substitutes for a missing observation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Payload readers close descriptors before return; local byte buffers become collectible after hashing. Named metadata transfers to the caller; trace-root and process joins remain coordinator-owned.
 */
export function pairE2eCommandFileObservation(
  phase: TracePhaseObservation<unknown>,
  input: {
    writerPid: number;
    event: "native-artifact" | "selected-file-observation";
    owner?: string;
    producerAsset: string;
    minimumCalls: number;
  },
): { invocations: string[]; problems: string[]; completenessCertified: false } {
  if (
    !Number.isSafeInteger(input.writerPid) ||
    input.writerPid <= 0 ||
    !Number.isSafeInteger(input.minimumCalls) ||
    input.minimumCalls < 1
  )
    throw new Error(
      "Command file pairing requires actual writer PID and explicit positive call requirement",
    );
  const problems: string[] = [];
  const before = phase.assetsBefore.find(
    (asset) => asset.label === input.producerAsset,
  );
  const after = phase.assetsAfter?.find(
    (asset) => asset.label === input.producerAsset,
  );
  if (
    !before ||
    !after ||
    before.requestedPath !== after.requestedPath ||
    before.realPath !== after.realPath ||
    before.sha256 !== after.sha256 ||
    JSON.stringify(before.identityAfter) !==
      JSON.stringify(after.identityBefore)
  )
    problems.push("Missing or changing independently prepared executable file");
  if (
    !phase.traces ||
    phase.observationErrors.length ||
    phase.traces.integrityProblems.length ||
    phase.traces.incompleteProcessInvocations.length
  )
    problems.push("Phase has incomplete or failed observations");
  const rows = (phase.traces?.writerObservations ?? []).filter(
    (row) => row.observation.writerPid === input.writerPid,
  );
  const invocations: string[] = [];
  for (const row of rows) {
    const event = row.observation;
    const data = event.data ?? {};
    if (
      event.event !== input.event ||
      (input.owner !== undefined && data.owner !== input.owner)
    )
      continue;
    const nativeStreamedHash =
      input.event === "selected-file-observation" &&
      data.fileObservation === "native-streamed-hash";
    const nativeCommand =
      input.event === "native-artifact" || nativeStreamedHash;
    if (
      before &&
      data.realPath !== before.realPath &&
      data.requestedPath !== before.requestedPath
    )
      continue;
    const sameCall = rows.filter(
      (candidate) =>
        candidate.writerFile === row.writerFile &&
        candidate.observation.invocation === event.invocation,
    );
    const attempt = sameCall.find(
      (candidate) => candidate.observation.event === "process-attempt",
    );
    const result = sameCall.find(
      (candidate) => candidate.observation.event === "process-result",
    );
    const start = sameCall.find(
      (candidate) => candidate.observation.event === "process-start",
    );
    const exit = sameCall.find(
      (candidate) => candidate.observation.event === "process-exit",
    );
    const close = sameCall.find(
      (candidate) => candidate.observation.event === "process-close",
    );
    if (
      data.outcome !== "complete" ||
      !before ||
      data.realPath !== before.realPath ||
      data.sha256 !== before.sha256
    )
      problems.push(
        "Selected command file does not match its independent preparation: " +
          event.invocation,
      );
    if (!phase.traces?.writerRuntimeVersions[row.writerFile])
      problems.push(
        "Missing actual command observer runtime: " + row.writerFile,
      );
    if (nativeCommand) {
      if (
        data.sameHandleIdentity !== true ||
        data.samePathIdentity !== true ||
        data.metadataUnchanged !== true ||
        data.realPathAfter !== data.realPath ||
        !data.identityBefore ||
        !data.identityAfter ||
        JSON.stringify(data.identityBefore) !==
          JSON.stringify(data.identityAfter)
      )
        problems.push(
          "Unstable native command artifact identity: " + event.invocation,
        );
      if (nativeStreamedHash) {
        if (
          !Number.isSafeInteger(data.observedBytes) ||
          Number(data.observedBytes) < 0 ||
          Number(data.observedBytes) > 512 * 1024 * 1024 ||
          data.observedBytes !== before?.observedBytes
        )
          problems.push(
            "Native streamed command byte count differs from preparation: " +
              event.invocation,
          );
      } else {
        try {
          const captured = readE2eTracePayload(
            phase.traceRoot,
            event,
            data.raw,
          );
          if (
            captured.bytes.length !== data.observedBytes ||
            crypto.createHash("sha256").update(captured.bytes).digest("hex") !==
              data.sha256
          )
            problems.push(
              "Retained command bytes/hash differ: " + event.invocation,
            );
        } catch (error) {
          problems.push("Missing command artifact bytes: " + String(error));
        }
      }
    } else if (
      !data.identityBefore ||
      !data.identityAfter ||
      !data.identityAtPathAfter ||
      JSON.stringify(data.identityBefore) !==
        JSON.stringify(data.identityAfter) ||
      JSON.stringify(data.identityAfter) !==
        JSON.stringify(data.identityAtPathAfter)
    ) {
      problems.push(
        "Unstable test-owned selected file identity: " + event.invocation,
      );
    }
    const resultData = result?.observation.data ?? {};
    const actualStarted = result?.observation.started ?? resultData.started;
    const actualExitObserved =
      result?.observation.exitObserved ?? resultData.exitObserved;
    const resultFields = result?.observation as typeof event & {
      status?: number | null;
      signal?: string | null;
      error?: unknown;
    };
    // A negative product exit does not revoke a real start and observed exit.
    // This binds the before-call file; it does not accept the command's result
    // as correct or suppress its independently collected profile failure.
    const synchronousStatus = nativeCommand
      ? resultData.exitCode
      : resultFields?.status;
    const synchronousSignal = nativeCommand
      ? resultData.signal
      : resultFields?.signal;
    const terminationObserved =
      (Number.isSafeInteger(synchronousStatus) &&
        Number(synchronousStatus) >= 0) ||
      (typeof synchronousSignal === "string" && synchronousSignal.length > 0);
    const selectedPath = attempt?.observation.data?.selectedPath;
    const requestedArgv = (
      attempt?.observation as typeof event & { argv?: unknown[] }
    )?.argv;
    const selectedCommand = nativeCommand ? selectedPath : requestedArgv?.[0];
    const synchronous =
      result !== undefined &&
      attempt !== undefined &&
      attempt.observation.sequence < result.observation.sequence &&
      actualStarted === true &&
      actualExitObserved === true &&
      Number(result.observation.pid) > 0 &&
      terminationObserved;
    const asyncExit = exit?.observation as typeof resultFields;
    const asyncClose = close?.observation as typeof resultFields;
    const asynchronous =
      input.event === "selected-file-observation" &&
      !nativeStreamedHash &&
      result === undefined &&
      attempt !== undefined &&
      start !== undefined &&
      exit !== undefined &&
      close !== undefined &&
      attempt.observation.sequence < start.observation.sequence &&
      start.observation.sequence < exit.observation.sequence &&
      exit.observation.sequence < close.observation.sequence &&
      Number(start.observation.pid) > 0 &&
      start.observation.pid === exit.observation.pid &&
      exit.observation.pid === close.observation.pid &&
      asyncExit.status === asyncClose.status &&
      asyncExit.signal === asyncClose.signal &&
      ((Number.isSafeInteger(asyncExit.status) &&
        Number(asyncExit.status) >= 0) ||
        (typeof asyncExit.signal === "string" && asyncExit.signal.length > 0));
    if (
      !attempt ||
      event.sequence >= attempt.observation.sequence ||
      selectedCommand !== data.requestedPath ||
      !(synchronous || asynchronous)
    )
      problems.push(
        "Missing later started and terminated actual command for file observation: " +
          event.invocation,
      );
    else invocations.push(event.invocation);
  }
  if (new Set(invocations).size < input.minimumCalls)
    problems.push("Missing explicitly required before-call file connections");
  return { invocations, problems, completenessCertified: false };
}
