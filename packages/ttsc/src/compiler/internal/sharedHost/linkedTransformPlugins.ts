import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import { isLinkedTransform } from "./isLinkedTransform";

/**
 * Return every plugin whose transform source is linked into another host binary
 * rather than owning the process. The host binary passes these via
 * `TTSC_LINKED_PLUGINS_JSON` so their Go code runs inside the same process.
 *
 * @evidence contracts/common.md#principled-implementation Filtering through the shared ownership predicate preserves source order and descriptor identities while selecting only statically linked transform libraries.
 * @evidence contracts/common.md#clear-and-simple-design The collector delegates ownership classification rather than duplicating it beside manifest publication.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No plugin name or fixture dictates selection; stage and kind express the actual linked-library contract.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains which descriptors are returned and why the host forwards them, following the documentation skill.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Filtering descriptor ownership does not interpret native paths or spawn processes; the native manifest consumer owns that boundary.
 *
 * @evidence contracts/performance.md#efficient-algorithms A single O(P) scan collects linked descriptors in order, using O(L) returned references for L matches without copying descriptor contents.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The input is caller-owned and the returned array is independently mutable; this collector coordinates no stable cross-request computation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The filtered array transfers to the caller, and no historical plugin population or native resource remains here.
 */
export function linkedTransformPlugins(
  plugins: readonly ITtscLoadedNativePlugin[],
): ITtscLoadedNativePlugin[] {
  return plugins.filter(isLinkedTransform);
}
