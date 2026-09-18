import { type FilesystemPathIdentityContext } from "../../../internal/pathIdentity/FilesystemPathIdentityContext";
import { createFilesystemPathIdentityContext } from "../../../internal/pathIdentity/createFilesystemPathIdentityContext";

/**
 * True when `real` is `directory` itself or sits beneath it. Handles a root
 * `directory` (`/`, `C:\`): naively appending a separator would yield `//`,
 * which no path starts with, so a root `rootDir` project would serve nothing.
 * Both sides are normalized to native separators first: a manifest `rootDir`
 * arrives slash-normalized from the synthesized tsconfig (`C:/` on Windows)
 * while `real` paths are native, and a raw prefix comparison across the two
 * forms silently never matches. Filesystem identity preserves ordinary Windows
 * aliases while keeping case-distinct paths under an opted-in directory
 * separate. Exported for direct exercise by the ttsx e2e suite — spawned runs
 * cannot pin both Windows case-semantics branches on CI.
 */
export function isWithin(
  real: string,
  directory: string,
  identities: FilesystemPathIdentityContext = createFilesystemPathIdentityContext(
    { throwOnRealpathError: false },
  ),
): boolean {
  return identities.isWithin(directory, real);
}
