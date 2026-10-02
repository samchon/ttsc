import type { TracePhaseObservation } from "./captureE2eTracePhase";

/**
 * Pairs caller-selected boundary requirements with actual phase observations.
 * Requirements must come from the selected runner's independent ownership
 * manifest, not be manufactured from the rows being checked. A matching row
 * does not certify loaded image identity, unobserved calls or descendant joins.
 *
 * @evidence contracts/common.md#principled-implementation Checks named actual writer/event/data observations against explicit requirements and before/after producer file identities, reporting missing or unstable evidence without expected process counts.
 * @evidence contracts/common.md#clear-and-simple-design One requirement list and one captured phase yield named pairing results; runtime/file facts and completeness remain separate responsibilities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not PID-deduplicate launches, infer upstream Programs, create missing writer rows or convert a caller-supplied requirement list into certified completeness.
 * @evidence contracts/common.md#meaningful-documentation States independent requirement origin, actual pairing scope and unproven loaded-image/join/population limits.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Compares already recorded metadata only. Native filesystem/process capability belongs to the capture and actual writer owners.
 * @evidence contracts/performance.md#efficient-algorithms Indexes phase rows by actual writer PID/event and prepared assets by label, then examines matching candidate rows and selected data fields. Retention scales with actual rows and requirements; no native file reread occurs.
 * @evidence contracts/performance.md#reuse-equivalent-work Reuses the phase's actual parsed rows and bracketed file observations for every requirement; facts from another phase are not borrowed.
 * @evidence contracts/performance.md#bound-retention-and-release-resources No native handles or running tasks are acquired. Indexes are local and named metadata results transfer to the caller; raw phase/payload/root retention remains coordinator-owned.
 */
export function pairE2eTraceWriterManifest(
  phase: TracePhaseObservation<unknown>,
  requirements: readonly TraceBoundaryRequirement[],
): { boundaries: TraceBoundaryPairing[]; completenessCertified: false } {
  const previous = new Map(phase.assetsBefore.map(asset => [asset.label, asset]));
  const current = new Map(phase.assetsAfter?.map(asset => [asset.label, asset]));
  const byWriterEvent = new Map<string, NonNullable<typeof phase.traces>["writerObservations"]>();
  for (const row of phase.traces?.writerObservations ?? []) {
    const key = `${row.observation.writerPid}:${row.observation.event}`;
    const group = byWriterEvent.get(key);
    if (group) group.push(row);
    else byWriterEvent.set(key, [row]);
  }
  const names = new Set<string>();
  const boundaries = requirements.map(requirement => {
    if (names.has(requirement.boundary)) throw new Error("Duplicate required boundary: " + requirement.boundary);
    names.add(requirement.boundary);
    const problems: string[] = [];
    if (!Number.isSafeInteger(requirement.writerPid) || requirement.writerPid <= 0)
      problems.push("Required writer lacks actual positive PID");
    if (requirement.producerAssets.length === 0)
      problems.push("Required boundary has no selected producer assets");
    for (const label of requirement.producerAssets) {
      const before = previous.get(label);
      const after = current.get(label);
      if (!before || !after) problems.push("Missing selected producer observation: " + label);
      else if (before.requestedPath !== after.requestedPath || before.realPath !== after.realPath ||
        before.sha256 !== after.sha256 || JSON.stringify(before.identityAfter) !== JSON.stringify(after.identityBefore))
        problems.push("Selected producer changed across phase: " + label);
    }
    const matches = (byWriterEvent.get(`${requirement.writerPid}:${requirement.event}`) ?? [])
      .filter(row => Object.entries(requirement.data ?? {}).every(([key, expected]) =>
        Object.hasOwn(row.observation.data ?? {}, key) && row.observation.data?.[key] === expected));
    if (matches.length === 0) problems.push("Missing required writer/event observation");
    for (const writerFile of new Set(matches.map(row => row.writerFile))) {
      if (!phase.traces?.writerRuntimeVersions[writerFile])
        problems.push("Missing actual writer runtime report: " + writerFile);
    }
    return {
      boundary: requirement.boundary, writerPid: requirement.writerPid,
      observations: matches.map(row => ({ writerFile: row.writerFile,
        invocation: row.observation.invocation, sequence: row.observation.sequence })),
      problems,
    };
  });
  return { boundaries, completenessCertified: false };
}

/** Actual selected owner PID and primitive/domain discriminator, not expected starts. */
export interface TraceBoundaryRequirement {
  boundary: string;
  writerPid: number;
  event: string;
  data?: Readonly<Record<string, string | number | boolean | null>>;
  producerAssets: readonly string[];
}

/** Named matching references retain writer/sequence/invocation distinctions. */
export interface TraceBoundaryPairing {
  boundary: string;
  writerPid: number;
  observations: { writerFile: string; invocation: string; sequence: number }[];
  problems: string[];
}
