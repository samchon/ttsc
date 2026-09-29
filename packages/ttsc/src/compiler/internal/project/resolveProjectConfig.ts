import type { ITtscProjectLocatorOptions } from "../../../structures/internal/ITtscProjectLocatorOptions";
import { resolveProjectIdentity } from "./resolveProjectIdentity";

/**
 * Resolve the physical tsconfig/jsconfig selected for a ttsc invocation.
 *
 * An explicit config wins; otherwise discovery walks upward from the file's
 * directory or the invocation directory. Discovery does not check root-file
 * membership or follow solution references. That separate responsibility
 * belongs to `resolveOwningProjectConfig`.
 *
 * Returns the real (symlink-resolved) absolute config path. Use
 * {@link resolveProjectIdentity} when both the caller-selected spelling and the
 * Program identity are required.
 *
 * @evidence contracts/common.md#principled-implementation Selecting physicalConfigPath from resolveProjectIdentity preserves the shared explicit-config and ancestor-discovery semantics without pretending discovery proves file membership.
 * @evidence contracts/common.md#clear-and-simple-design This adapter returns one path; lexical/physical identity and discovery remain owned by the shared resolver.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No caller-specific config spelling or fallback search is added around the identity resolver.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish config selection from reference ownership and identify the richer identity API, following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and realpath behavior remain with resolveProjectIdentity; this adapter returns its physical path without independently folding case or interpreting protocol paths.
 */
export function resolveProjectConfig(
  opts: ITtscProjectLocatorOptions = {},
): string {
  return resolveProjectIdentity(opts).physicalConfigPath;
}
