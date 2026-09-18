import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import { isLinkedTransform } from "./isLinkedTransform";

/**
 * Return every plugin whose transform source is linked into another host binary
 * rather than owning the process. The host binary passes these via
 * `TTSC_LINKED_PLUGINS_JSON` so their Go code runs inside the same process.
 */
export function linkedTransformPlugins(
  plugins: readonly ITtscLoadedNativePlugin[],
): ITtscLoadedNativePlugin[] {
  return plugins.filter(isLinkedTransform);
}
