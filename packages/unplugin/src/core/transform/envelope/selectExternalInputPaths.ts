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
 * regular-file paths currently eligible for the project walk and the disposable
 * transform scratch tree. Eligibility is not a certificate that an earlier
 * selected or incomplete snapshot actually read a file; capture and admission
 * retain responsibility for that proof. Resolution candidates that are still
 * missing remain in this set even under the project root: the first walk cannot
 * hash a file that has not been created yet.
 *
 * A `dependenciesComplete` declaration deliberately does not narrow the stored
 * set: other files in the same whole-project result can still own the omitted
 * members. Persistent validation selects the requested file's subset through
 * `selectWatchInputs`, while graph-free envelopes use this union as their
 * conservative fallback.
 *
 * @evidence contracts/common.md#principled-implementation Whole-generation union retains paths outside current regular-file walk eligibility and unavailable resolver candidates; completeness of one file cannot discard another file's shared input. The walk capture/admission owner must separately establish recorded hashes and completeness for eligible paths rather than treating this selector as an earlier-read certificate.
 * @evidence contracts/common.md#clear-and-simple-design Collection precedes one filtering pass over scratch, temporary input, lexical duplicates and project membership, with filesystem and membership semantics delegated to their shared helpers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing candidates remain observable rather than being dropped merely because no current project hash exists; the temporary-config exclusion refers to an actual generated input rather than a consumer-specific escape.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain whole-project scope, project-walk gaps, missing candidates and why completeness cannot narrow the stored union; separated tags follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Injected filesystem capabilities drive identity, existence and membership checks; lexical native spellings remain distinct for alias changes while physical identity excludes the temporary config consistently across host filesystems.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Cold graph index construction precedes separate scans of output, graph,
 *   candidate, dependency and host lists, followed by every collected member's
 *   filter pass. Lexical deduplication precedes native identity/candidate/walk
 *   observations, including rejected members; distinct aliases stay separate. Native path/ancestor/case, existence and walk policy/component checks
 *   add costs to list/key text. Collected members, candidate/seen sets and
 *   output allocate population-sized storage; final string sorting adds output
 *   comparison work.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Generation state shares completed graph parsing, while this call's native
 *   identity context reuses its qualified path observations. The sets dedupe
 *   every lexical classification and mark candidate membership. Supplied filesystem, producer-derived state
 *   and membership policy must represent the same stable generation view.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Its collections are local to the call and released on return; only the
 *   sorted output is handed back.
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
  for (const entryToAppend of Object.keys(props.result.typescript))
    members.push(entryToAppend);
  if (graph !== undefined) {
    for (const [source, targets] of Object.entries(graph.edges ?? {})) {
      members.push(source);
      if (Array.isArray(targets)) {
        for (const entryToAppend of targets) members.push(entryToAppend);
      }
    }
    for (const listed of [
      graph.globals,
      graph.configs,
      graph.resolutionInputs,
    ]) {
      if (Array.isArray(listed)) {
        for (const entryToAppend of listed) members.push(entryToAppend);
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
      for (const entryToAppend of entries) members.push(entryToAppend);
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
    // Classify each lexical address once, including rejected walk members.
    // Physical aliases remain distinct so retargeting is still observable.
    if (seen.has(spelling)) continue;
    seen.add(spelling);
    const identity = pathIdentityKey(absolute, identities);
    const observation = graphIndexes.inputObservations.get(spelling);
    const missingCandidate =
      resolutionCandidates.has(spelling) &&
      (observation?.fileExists === false ||
        (observation === undefined && !filesystem.exists(absolute)));
    if (
      identity === excluded ||
      isTransformScratchInput(absolute, props.scratchDirectory) ||
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
    output.push(absolute);
  }
  output.sort();
  return output;
}
