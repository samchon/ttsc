import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";
import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import { toProjectKey } from "../project/toProjectKey";
import { isTransformScratchInput } from "../tsconfig/isTransformScratchInput";

/**
 * Project-walk keys of every input the envelope declares: the reference graph's
 * edge endpoints, globals, config chain, and resolution candidates, plus the
 * universal host inputs and the plugin-reported dependencies, intersected with
 * the files the project walk actually hashed. Out-of-walk declarations and
 * candidates carry their own graph proof; asking the project observer to
 * witness them as well makes unrelated activity in ignored directories
 * invalidate an otherwise complete generation. Returns `undefined` for an
 * successful envelope with no graph, and for failed results whose diagnostics
 * concern the whole program rather than a successful output's dependency set.
 * Both keep whole-walk comparison.
 *
 * @evidence contracts/common.md#principled-implementation Declared inputs intersect actual project snapshot keys, so narrowing never asks the project walk to prove out-of-walk inputs; undefined preserves whole-walk comparison when the graph cannot declare a bound.
 * @evidence contracts/common.md#clear-and-simple-design A local add adapter owns validity, scratch exclusion and project-key intersection, while each producer input category contributes through that same rule.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Out-of-walk and unresolved inputs retain their separate proof responsibility instead of being inserted into a fictitious project snapshot; malformed entries supply no declarations.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains input categories, intersection, external proof ownership and undefined fallback, with a separate acknowledgment block under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Entry expansion uses Node host-native path.resolve; the supplied context must describe that same native address domain and decides actual case/link identity before project hash-key encoding. This operation selects no independent foreign-view path grammar or global case rule.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Visits each reported occurrence in graph endpoints/globals/configs,
 *   candidates, host inputs and dependency arrays. Native resolve, scratch
 *   checks, project-key identity/ancestor/case observations and text hashing
 *   precede each own-key membership test after lexical deduplication; repeated
 *   declarations pay resolution but no repeated native classification. Entry
 *   arrays from Object.entries/Object.values follow producer populations,
 *   while the returned set cannot exceed keys present in the project snapshot.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   The generation memo owner shares this completed selection, including
 *   undefined whole-walk policy. This selector retains no cross-call verdict;
 *   native identity observations are shared by its caller-owned context.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The key set is local to the call and handed to the caller.
 */
export function selectDeclaredProjectInputKeys(props: {
  identities: FilesystemPathIdentityContext;
  projectInputHashes: Readonly<Record<string, string>>;
  projectRoot: string;
  result: ITtscCompilerTransformation;
  scratchDirectory?: string;
}): Set<string> | undefined {
  if (props.result.type !== "success" || props.result.graph === undefined) {
    return undefined;
  }
  const graph = props.result.graph;
  const keys = new Set<string>();
  const seen = new Set<string>();
  const add = (entry: unknown): void => {
    if (typeof entry !== "string" || entry.length === 0) return;
    const absolute = path.resolve(props.projectRoot, entry);
    if (seen.has(absolute)) return;
    seen.add(absolute);
    if (isTransformScratchInput(absolute, props.scratchDirectory)) return;
    const key = toProjectKey(props.projectRoot, absolute, props.identities);
    if (Object.prototype.hasOwnProperty.call(props.projectInputHashes, key)) {
      keys.add(key);
    }
  };
  for (const [source, targets] of Object.entries(graph.edges ?? {})) {
    add(source);
    if (Array.isArray(targets)) for (const target of targets) add(target);
  }
  if (Array.isArray(graph.globals))
    for (const input of graph.globals) add(input);
  if (Array.isArray(graph.configs))
    for (const input of graph.configs) add(input);
  if (Array.isArray(graph.resolutionInputs))
    for (const input of graph.resolutionInputs) add(input);
  for (const [source, candidates] of Object.entries(graph.candidates ?? {})) {
    add(source);
    if (Array.isArray(candidates)) for (const entry of candidates) add(entry);
  }
  if (Array.isArray(props.result.hostInputs))
    for (const input of props.result.hostInputs) add(input);
  // Plugin-reported dependencies are inputs the graph never sees: a utility
  // plugin's own config file is consulted by the plugin, not by the compiler.
  for (const reported of Object.values(props.result.dependencies ?? {})) {
    if (Array.isArray(reported)) for (const input of reported) add(input);
  }
  return keys;
}
