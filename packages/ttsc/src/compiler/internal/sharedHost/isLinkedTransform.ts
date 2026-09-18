import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";

/**
 * Reports whether the given transform source is linked into another compiler
 * host instead of owning the process itself.
 */
export function isLinkedTransform(plugin: ITtscLoadedNativePlugin): boolean {
  return plugin.stage === "transform" && plugin.kind === "linked";
}
