import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { isProjectWalkPath } from "../project/isProjectWalkPath";
import { isTransformScratchInput } from "../tsconfig/isTransformScratchInput";
import { envelopeDerivation } from "./envelopeDerivation";
import { envelopeGraphIndexes } from "./envelopeGraphIndexes";

/**
 * Derive the absolute out-of-walk input set of a whole project transform: the
 * union of every transformed source key, reference-graph member (edge keys and
 * targets, globals, the config chain), and plugin-reported dependency, minus
 * everything the project walk already hashes and the disposed transform scratch
 * tree. These are the inputs `matchesCachedSource`'s walk cannot see.
 * Resolution candidates that are still missing remain in this set even under
 * the project root: the first walk cannot hash a file that has not been created
 * yet.
 *
 * A `dependenciesComplete` declaration deliberately does not narrow the stored
 * set: other files in the same whole-project result can still own the omitted
 * members. Persistent validation selects the requested file's subset through
 * `selectWatchInputs`, while graph-free envelopes use this union as their
 * conservative fallback.
 */
export function selectExternalInputPaths(props: {
  filesystem?: TtscTransformFilesystemOperations;
  membershipPolicy: ITtscProjectMembershipPolicy;
  projectRoot: string;
  result: ITtscCompilerTransformation;
  scratchDirectory?: string;
  temporaryTsconfig?: string;
}): string[] {
  if (props.result.type === "exception") {
    return [];
  }
  const members: string[] = [];
  const filesystem = props.filesystem ?? DEFAULT_FILESYSTEM_OPERATIONS;
  const identities = createHostPathIdentityContext(filesystem);
  const resolutionCandidates = new Set<string>();
  const graph = props.result.graph;
  const graphState = envelopeDerivation({
    projectRoot: props.projectRoot,
    result: props.result,
  });
  const graphIndexes = envelopeGraphIndexes(graphState, {
    projectRoot: props.projectRoot,
    result: props.result,
  });
  // Every transform output key names the source file whose transformed text it
  // carries. Keep an out-of-walk source in the external snapshot instead of
  // injecting it into the project-walk key universe (samchon/ttsc#252).
  members.push(...Object.keys(props.result.typescript));
  if (graph !== undefined) {
    for (const [source, targets] of Object.entries(graph.edges ?? {})) {
      members.push(source);
      if (Array.isArray(targets)) {
        members.push(...targets);
      }
    }
    for (const listed of [
      graph.globals,
      graph.configs,
      graph.resolutionInputs,
    ]) {
      if (Array.isArray(listed)) {
        members.push(...listed);
      }
    }
    for (const candidates of Object.values(graph.candidates ?? {})) {
      if (!Array.isArray(candidates)) {
        continue;
      }
      for (const candidate of candidates) {
        if (typeof candidate !== "string" || candidate.length === 0) {
          continue;
        }
        const absolute = path.resolve(props.projectRoot, candidate);
        members.push(candidate);
        resolutionCandidates.add(path.resolve(absolute));
      }
    }
    for (const input of graph.resolutionInputs ?? []) {
      if (typeof input === "string" && input.length !== 0) {
        resolutionCandidates.add(path.resolve(props.projectRoot, input));
      }
    }
  }
  for (const entries of Object.values(props.result.dependencies ?? {})) {
    if (Array.isArray(entries)) {
      members.push(...entries);
    }
  }
  if (Array.isArray(props.result.hostInputs)) {
    for (const input of props.result.hostInputs) {
      members.push(input);
      if (typeof input === "string" && input.length !== 0) {
        // Plugin discovery inputs deliberately include absent config and
        // resolution probes. A project walk cannot snapshot a path that does
        // not exist yet, even when its spelling lies below projectRoot.
        resolutionCandidates.add(path.resolve(props.projectRoot, input));
      }
    }
  }
  const excluded =
    props.temporaryTsconfig === undefined
      ? undefined
      : pathIdentityKey(props.temporaryTsconfig, identities);
  const output: string[] = [];
  const seen = new Set<string>();
  for (const member of members) {
    if (typeof member !== "string" || member.length === 0) {
      continue;
    }
    const absolute = path.resolve(props.projectRoot, member);
    const spelling = path.resolve(absolute);
    const identity = pathIdentityKey(absolute, identities);
    const observation = graphIndexes.inputObservations.get(spelling);
    const missingCandidate =
      resolutionCandidates.has(spelling) &&
      (observation?.fileExists === false ||
        (observation === undefined && !filesystem.exists(absolute)));
    if (
      identity === excluded ||
      isTransformScratchInput(absolute, props.scratchDirectory) ||
      seen.has(spelling) ||
      (!missingCandidate &&
        isProjectWalkPath(
          props.projectRoot,
          absolute,
          identities,
          filesystem,
          props.membershipPolicy,
        ))
    ) {
      continue;
    }
    // Preserve distinct lexical aliases even when they currently select the
    // same physical file. A later retarget must validate the alias itself.
    seen.add(spelling);
    output.push(absolute);
  }
  output.sort();
  return output;
}
