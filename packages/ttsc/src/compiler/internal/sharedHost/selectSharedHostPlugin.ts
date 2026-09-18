import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import { isLinkedTransform } from "./isLinkedTransform";

/**
 * Picks the native binary that must own the compiler pass. Linked transform
 * sources ride inside a host that uses driver.LoadProgram, so an executable
 * transform wins when one is present.
 */
export function selectSharedHostPlugin(
  plugins: readonly ITtscLoadedNativePlugin[],
): ITtscLoadedNativePlugin {
  return plugins.find((plugin) => !isLinkedTransform(plugin)) ?? plugins[0]!;
}
