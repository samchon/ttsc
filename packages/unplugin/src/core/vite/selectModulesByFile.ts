import { createHostPathIdentityContext } from "../transform/filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../transform/filesystem/pathIdentityKey";
import type { ViteModuleGraphLike } from "./ViteModuleGraphLike";
import type { ViteModuleNodeLike } from "./ViteModuleNodeLike";

/**
 * Look up the module nodes registered for one importer spelling: the fast
 * slash-normalized `getModulesByFile` lookup first, then an identity scan of
 * `fileToModulesMap` for native aliases, physical targets or case-equivalent
 * spellings. A nonempty exact result suppresses that fallback scan.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Vite's exact slash-normalized lookup is authoritative when populated; the
 *   exposed file map supplies remaining nodes whose filesystem identities match.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This helper owns exact-then-identity lookup so invalidation and reload use
 *   one module-selection policy without inspecting opaque node fields.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The fallback compares shared filesystem identity instead of guessing path
 *   equivalence from spelling or replacing a foreign graph method.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose identifies the fast lookup and identity fallback, separated
 *   from acknowledgments according to documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Vite's exact lookup receives slash-normalized importer spelling. Fallback
 *   compares native identities from the shared filesystem resolver, including
 *   physical aliases and observed case policy, without rewriting host node data.
 * @evidence contracts/performance.md#efficient-algorithms
 *   A nonempty exact result copies D nodes. Fallback visits G file keys and
 *   copies N matching node occurrences, with native identity path/ancestor and
 *   case observations; opaque map entries provide no reverse identity index.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   One fresh fallback transaction shares path, realpath and case observations
 *   across importer and file keys. It ends with this call, so later lookups do
 *   not reuse stale aliases. This is an observation window, not an atomic scan.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The synchronous lookup acquires no native handle or running task. Its
 *   identity maps become unreachable on return or throw; returned node
 *   references and the host graph's retained population belong to their callers.
 */
export function selectModulesByFile(
  graph: ViteModuleGraphLike,
  importer: string,
): ViteModuleNodeLike[] {
  const direct = graph.getModulesByFile?.(importer.replace(/\\/g, "/"));
  if (direct !== undefined && direct.size !== 0) {
    return [...direct];
  }
  const identities = createHostPathIdentityContext();
  const identity = pathIdentityKey(importer, identities);
  const output: ViteModuleNodeLike[] = [];
  for (const [file, nodes] of graph.fileToModulesMap ?? []) {
    if (
      typeof file === "string" &&
      pathIdentityKey(file, identities) === identity
    ) {
      for (const entryToAppend of nodes) output.push(entryToAppend);
    }
  }
  return output;
}
