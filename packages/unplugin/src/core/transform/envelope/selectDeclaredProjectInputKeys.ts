import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";
import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import { toProjectKey } from "../project/toProjectKey";
import { isTransformScratchInput } from "../tsconfig/isTransformScratchInput";

/**
 * Project-walk keys of every input the envelope declares: the reference graph's
 * edge endpoints, globals, config chain, and resolution candidates, plus the
 * universal host inputs, intersected with the files the project walk actually
 * hashed. Out-of-walk declarations and candidates carry their own graph proof;
 * asking the project observer to witness them as well makes unrelated activity
 * in ignored directories invalidate an otherwise complete generation. Returns
 * `undefined` for an envelope with no graph, which declares no input set and
 * therefore keeps whole-walk comparison.
 */
export function selectDeclaredProjectInputKeys(props: {
  identities: FilesystemPathIdentityContext;
  projectInputHashes: Readonly<Record<string, string>>;
  projectRoot: string;
  result: ITtscCompilerTransformation;
  scratchDirectory?: string;
}): Set<string> | undefined {
  if (props.result.type === "exception" || props.result.graph === undefined) {
    return undefined;
  }
  const graph = props.result.graph;
  const keys = new Set<string>();
  const add = (entry: unknown): void => {
    if (typeof entry !== "string" || entry.length === 0) return;
    const absolute = path.resolve(props.projectRoot, entry);
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
