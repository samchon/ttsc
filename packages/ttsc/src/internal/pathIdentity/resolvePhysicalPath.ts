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
 *
 * @returns Its physical spelling, or `location` itself.
 *
 * @evidence contracts/common.md#principled-implementation The shared resolver follows existing ancestors and canonicalizes missing suffixes; an unavailable answer falls back to the caller's path because this best-effort utility is not a deletion authorization.
 * @evidence contracts/common.md#clear-and-simple-design The physical-path view delegates to the owning identity resolver and has one total fallback; it does not duplicate alias or case policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failure preserves the original usable spelling rather than fabricating a proved identity, and no foreign filesystem behavior is patched.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the absolute-path premise and total fallback, keeping use meaning separate from tags.
 * @evidence contracts/portability.md#os-neutral-implementation Realpath and case semantics come from the shared native boundary; unavailable case policy preserves missing spelling, and the total error fallback remains best-effort rather than a proved alias guarantee.
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
