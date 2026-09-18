import type { ITtscProjectLocatorOptions } from "../../../structures/internal/ITtscProjectLocatorOptions";
import { resolveProjectIdentity } from "./resolveProjectIdentity";

/**
 * Resolve the tsconfig/jsconfig that owns a ttsc invocation.
 *
 * Resolution order:
 *
 * 1. `opts.tsconfig` — resolved absolute and checked for existence.
 * 2. `opts.file` — the nearest ancestor config that contains the file is found by
 *    walking up from the file's directory.
 * 3. `opts.cwd` — the nearest ancestor config walking up from cwd.
 *
 * Returns the real (symlink-resolved) absolute config path. Use
 * {@link resolveProjectIdentity} when both the caller-selected spelling and the
 * Program identity are required.
 */
export function resolveProjectConfig(
  opts: ITtscProjectLocatorOptions = {},
): string {
  return resolveProjectIdentity(opts).physicalConfigPath;
}
