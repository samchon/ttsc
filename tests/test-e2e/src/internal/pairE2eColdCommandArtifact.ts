import crypto from "node:crypto";
import path from "node:path";
import type { TracePhaseObservation } from "./captureE2eTracePhase";
import { pairE2eTraceWriterManifest } from "./pairE2eTraceWriterManifest";
import { readE2eTracePayload } from "./readE2eTracePayload";

/**
 * Connects an actual cold build, retained file read and later owned Cmd uses.
 * Source/toolchain requirements are independently selected before execution.
 * The output address comes from the actual build argv; its hash is an observed
 * file fact, never an independent expected build output or loaded-image proof.
 *
 * @evidence contracts/common.md#principled-implementation Requires the same writer/invocation build attempt and result, complete before-first-use artifact bytes, unchanged native file observations and later successful command results selecting that actual output path.
 * @evidence contracts/common.md#clear-and-simple-design One explicit producer requirement binds phase source/toolchain observations and the cold output's retained bytes without forcing a nonexistent before-baseline asset.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not fabricate artifact rows, expected hashes, child counts, successful commands or image identity. Missing observations stay problems and completeness remains false.
 * @evidence contracts/common.md#meaningful-documentation Distinguishes derived actual build-output address, independent preparation requirements and observed file-byte equality from reproducibility, image loading and descendant joins.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Native identities were observed by the actual owning Go writer; this operation checks recorded facts and delegates retained-file reading to its native reader without OS-name classification.
 * @evidence contracts/performance.md#efficient-algorithms Visits the selected phase rows and matching command candidates, then reads each bounded artifact payload once to hash its actual bytes. Work and memory scale with rows plus captures, each at most64MiB.
 * @evidence contracts/performance.md#reuse-equivalent-work Reuses existing parsed phase rows and source/toolchain asset pairing; never borrows an artifact or command outcome from another phase.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Payload readers close before returning; local byte buffers become collectible after hashing. Named results transfer to the caller, which retains and cleans the joined trace root.
 */
export function pairE2eColdCommandArtifact(
  phase: TracePhaseObservation<unknown>,
  input: {
    writerPid: number;
    buildOwner: string;
    useOwner: string;
    rawLabel: string;
    buildPrefix: readonly string[];
    buildSuffix: readonly string[];
    usePrefix: readonly string[];
    minimumUses: number;
    producerAssets: readonly string[];
  },
): { artifacts: { path: string; sha256?: string; uses: string[]; problems: string[] }[]; problems: string[]; completenessCertified: false } {
  if (!Number.isSafeInteger(input.minimumUses) || input.minimumUses < 1)
    throw new Error("Cold artifact requires an explicit positive use requirement");
  if (!/^[a-z0-9-]+$/i.test(input.rawLabel))
    throw new Error("Cold artifact requires its actual owner-selected payload label");
  const preparation = pairE2eTraceWriterManifest(phase, [{
    boundary: input.buildOwner, writerPid: input.writerPid, event: "process-attempt",
    data: { owner: input.buildOwner }, producerAssets: input.producerAssets,
  }]);
  const problems = preparation.boundaries.flatMap(boundary => boundary.problems);
  if (phase.observationErrors.length || phase.traces?.integrityProblems.length ||
      phase.traces?.incompleteProcessInvocations.length || !phase.traces)
    problems.push("Phase contains incomplete or failed observations");
  const rows = (phase.traces?.writerObservations ?? [])
    .filter(row => row.observation.writerPid === input.writerPid);
  const artifacts = rows.filter(row => row.observation.event === "native-artifact" &&
    row.observation.data?.owner === input.buildOwner).map(row => {
    const event = row.observation;
    const data = event.data ?? {};
    const local: string[] = [];
    const requested = typeof data.requestedPath === "string" ? data.requestedPath : "";
    const sameWriter = rows.filter(candidate => candidate.writerFile === row.writerFile &&
      candidate.observation.instance === event.instance);
    const build = sameWriter.filter(candidate => candidate.observation.invocation === event.invocation);
    const attempt = build.find(candidate => candidate.observation.event === "process-attempt" &&
      candidate.observation.data?.owner === input.buildOwner);
    const result = build.find(candidate => candidate.observation.event === "process-result" &&
      candidate.observation.data?.owner === input.buildOwner);
    const argv = attempt?.observation.data?.argv;
    const outputIndex = Array.isArray(argv) ? argv.indexOf("-o") : -1;
    if (!Array.isArray(argv) || outputIndex < 0 || argv[outputIndex + 1] !== requested ||
      JSON.stringify(argv.slice(1, outputIndex)) !== JSON.stringify(input.buildPrefix) ||
      JSON.stringify(argv.slice(outputIndex + 2)) !== JSON.stringify(input.buildSuffix))
      local.push("Actual build argv does not bind the selected cold output");
    if (!attempt || !result || attempt.observation.sequence >= result.observation.sequence ||
      result.observation.sequence >= event.sequence || result.observation.data?.success !== true ||
      result.observation.data?.exitObserved !== true || result.observation.data?.exitCode !== 0 ||
      result.observation.data?.started !== true || !(Number(result.observation.pid) > 0))
      local.push("Missing successful joined build before artifact observation");
    if (!path.isAbsolute(requested) || data.outcome !== "complete" ||
      data.sameHandleIdentity !== true || data.samePathIdentity !== true || data.metadataUnchanged !== true ||
      typeof data.realPath !== "string" || data.realPath !== data.realPathAfter ||
      !data.identityBefore || typeof data.identityBefore !== "object" ||
      !data.identityAfter || typeof data.identityAfter !== "object" ||
      JSON.stringify(data.identityBefore) !== JSON.stringify(data.identityAfter) ||
      typeof data.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(data.sha256))
      local.push("Incomplete native artifact file identity or hash observation");
    try {
      const payload = readE2eTracePayload(phase.traceRoot, event, data.raw);
      if (!path.basename(payload.file).endsWith("-" + input.rawLabel + ".bin") ||
        payload.bytes.length !== data.observedBytes ||
        crypto.createHash("sha256").update(payload.bytes).digest("hex") !== data.sha256)
        local.push("Retained artifact bytes differ from the same invocation file observation");
    } catch (error) { local.push("Artifact payload unavailable: " + String(error)); }
    const uses: string[] = [];
    for (const candidate of sameWriter) {
      const use = candidate.observation;
      const useArgv = use.data?.argv;
      if (use.event !== "process-attempt" || use.data?.owner !== input.useOwner ||
        use.data?.selectedPath !== requested || !Array.isArray(useArgv) ||
        JSON.stringify(useArgv.slice(1, input.usePrefix.length + 1)) !== JSON.stringify(input.usePrefix)) continue;
      const ended = sameWriter.find(other => other.observation.invocation === use.invocation &&
        other.observation.event === "process-result" && other.observation.data?.owner === input.useOwner);
      if (use.sequence <= event.sequence || !ended || ended.observation.sequence <= use.sequence ||
        ended.observation.data?.selectedPath !== requested || ended.observation.data?.success !== true ||
        ended.observation.data?.exitObserved !== true || ended.observation.data?.exitCode !== 0 ||
        ended.observation.data?.started !== true || !(Number(ended.observation.pid) > 0))
        local.push("Actual artifact use lacks its later successful direct command result");
      else uses.push(use.invocation);
    }
    if (new Set(uses).size < input.minimumUses)
      local.push("Missing independently required artifact-use connections");
    return { path: requested, sha256: typeof data.sha256 === "string" ? data.sha256 : undefined, uses, problems: local };
  });
  if (artifacts.length === 0) problems.push("Missing cold-built native artifact observation");
  return { artifacts, problems, completenessCertified: false };
}
