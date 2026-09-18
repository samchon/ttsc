import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { sameHostInputRealpath } from "../inputs/sameHostInputRealpath";
import type { TtscWatchInputBaseline } from "./TtscWatchInputBaseline";
import type { TtscWatchInputEvidence } from "./TtscWatchInputEvidence";
import type { TtscWatchInputKeyBaseline } from "./TtscWatchInputKeyBaseline";
import { isWatchInputKeyBaseline } from "./isWatchInputKeyBaseline";

/** Compare generation evidence with the main process's exact key baseline. */
export function watchInputEvidenceMatchesBaseline(
  evidence: TtscWatchInputEvidence,
  baseline: TtscWatchInputKeyBaseline,
): boolean {
  if (
    !isWatchInputKeyBaseline(baseline) ||
    evidence.identity !== baseline.identity ||
    evidence.state === undefined
  ) {
    return false;
  }
  const broad = broadWatchInputBaseline(baseline);
  if (evidence.state.codec === "host") {
    return broad !== undefined && evidence.state.hash === broad.hostHash;
  }
  const identities = createHostPathIdentityContext();
  if (evidence.state.codec === "graph") {
    return (
      broad !== undefined &&
      evidence.state.hash === broad.graphHash &&
      sameHostInputRealpath(
        evidence.state.realpath,
        broad.realpath.ok ? broad.realpath.path : null,
        identities,
      )
    );
  }
  // A key baseline records one path's own state, and the project's root-file
  // membership is a walk over many; it never stands for one.
  if (evidence.state.codec === "membership") return false;
  const observation = evidence.state.observation;
  if (
    observation.fileExists !== undefined &&
    observation.fileExists !== baseline.fileExists
  ) {
    return false;
  }
  if (
    observation.directoryExists !== undefined &&
    (broad === undefined ||
      observation.directoryExists !== broad.directoryExists)
  ) {
    return false;
  }
  if (
    observation.stat !== undefined &&
    (broad === undefined || observation.stat !== broad.stat)
  ) {
    return false;
  }
  if (
    observation.readFile !== undefined &&
    (broad === undefined ||
      (observation.readFile.ok &&
        observation.readFile.hash !== broad.graphReadHash) ||
      (!observation.readFile.ok && broad.graphReadHash !== null))
  ) {
    return false;
  }
  if (observation.realpath !== undefined) {
    if (broad === undefined) {
      return false;
    }
    if (observation.realpath.ok !== broad.realpath.ok) {
      return false;
    }
    if (
      observation.realpath.ok &&
      broad.realpath.ok &&
      !sameHostInputRealpath(
        observation.realpath.path,
        broad.realpath.path,
        identities,
      )
    ) {
      return false;
    }
  }
  return true;
}

/** Return a broad baseline after the complete entry has been validated. */
function broadWatchInputBaseline(
  baseline: TtscWatchInputKeyBaseline,
): TtscWatchInputBaseline | undefined {
  return "directoryExists" in baseline ? baseline : undefined;
}
