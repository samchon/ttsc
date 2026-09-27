import { createFilesystemPathIdentityContext } from "./createFilesystemPathIdentityContext";

/**
 * `location` as the filesystem names it: every link and junction followed and
 * every existing segment spelled as the filesystem stores it
 * (`createFilesystemPathIdentityContext`).
 *
 * Total on purpose. A location the resolver cannot read keeps the spelling it
 * was given, which is what a caller had before asking.
 *
 * @param location An absolute path.
 * @returns Its physical spelling, or `location` itself.
 */
export function resolvePhysicalPath(location: string): string {
  try {
    return createFilesystemPathIdentityContext({
      throwOnRealpathError: false,
    }).resolve(location).path;
  } catch {
    return location;
  }
}
