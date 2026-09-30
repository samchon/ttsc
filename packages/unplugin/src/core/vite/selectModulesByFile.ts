import { pathIdentityKey } from "../transform/filesystem/pathIdentityKey";
import type { ViteModuleGraphLike } from "./ViteModuleGraphLike";
import type { ViteModuleNodeLike } from "./ViteModuleNodeLike";

/**
 * Look up the module nodes registered for one importer spelling: the fast
 * slash-normalized `getModulesByFile` lookup first, then an identity scan of
 * `fileToModulesMap` for spellings that differ only by separator or case.
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
 */
export function selectModulesByFile(
  graph: ViteModuleGraphLike,
  importer: string,
): ViteModuleNodeLike[] {
  const direct = graph.getModulesByFile?.(importer.replace(/\\/g, "/"));
  if (direct !== undefined && direct.size !== 0) {
    return [...direct];
  }
  const identity = pathIdentityKey(importer);
  const output: ViteModuleNodeLike[] = [];
  for (const [file, nodes] of graph.fileToModulesMap ?? []) {
    if (typeof file === "string" && pathIdentityKey(file) === identity) {
      for (const entryToAppend of nodes) output.push(entryToAppend);
    }
  }
  return output;
}
