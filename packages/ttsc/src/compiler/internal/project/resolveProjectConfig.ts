import type { ITtscProjectLocatorOptions } from "../../../structures/internal/ITtscProjectLocatorOptions";
import { resolveProjectIdentity } from "./resolveProjectIdentity";

/**
 * Resolve the selected tsconfig/jsconfig through its filesystem links.
 *
 * An explicit config wins; otherwise discovery walks upward from the file's
 * directory or the invocation directory. Discovery does not check root-file
 * membership or follow solution references. That separate responsibility
 * belongs to `resolveOwningProjectConfig`.
 *
 * Returns the symlink-resolved absolute config path when realpath succeeds;
 * otherwise the shared resolver preserves the selected absolute spelling.
 * That fallback does not certify physical identity. Use
 * {@link resolveProjectIdentity} when both the caller-selected spelling and the
 * Program identity are required.
 *
 * @evidence contracts/common.md#principled-implementation Selecting physicalConfigPath from resolveProjectIdentity preserves the shared explicit-config and ancestor-discovery semantics without pretending discovery proves file membership.
 * @evidence contracts/common.md#clear-and-simple-design This adapter returns one path; lexical/physical identity and discovery remain owned by the shared resolver.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No caller-specific config spelling or fallback search is added around the identity resolver.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish config selection from reference ownership and identify the richer identity API, following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native resolution and realpath behavior remain with resolveProjectIdentity; this adapter preserves its realpath-failure fallback without independently folding case or certifying the selected spelling as physically proven.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The synchronous resolver retains call-local paths and no open handle or historical state; the selected string transfers to the caller.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The shared resolver owns explicit selection, ancestor candidate traversal and realpath queries; this adapter adds only a field projection and chooses no separate processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each invocation observes current config selection through the shared resolver; this adapter retains no completed or in-flight answer for reuse.
 */
export function resolveProjectConfig(
  opts: ITtscProjectLocatorOptions = {},
): string {
  return resolveProjectIdentity(opts).physicalConfigPath;
}
