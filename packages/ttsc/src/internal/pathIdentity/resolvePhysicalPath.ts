import { createFilesystemPathIdentityContext } from "./createFilesystemPathIdentityContext";

/**
 * Best-effort physical spelling of `location`: resolved links and junctions
 * use the filesystem's returned spelling, followed by any unresolved suffix
 * (`createFilesystemPathIdentityContext`).
 *
 * Total on purpose. Native failures may leave an unresolved suffix after an
 * observed prefix; if the overall resolution throws, the original spelling is
 * returned. This is not proof that every existing segment was readable.
 *
 * @param location An absolute path.
 *
 * @returns Its best-effort spelling, or `location` itself on caught failure.
 *
 * @evidence contracts/common.md#principled-implementation The shared resolver follows existing ancestors and canonicalizes missing suffixes; an unavailable answer falls back to the caller's path because this best-effort utility is not a deletion authorization.
 * @evidence contracts/common.md#clear-and-simple-design The physical-path view delegates to the owning identity resolver and has one total fallback; it does not duplicate alias or case policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failure preserves the original usable spelling rather than fabricating a proved identity, and no foreign filesystem behavior is patched.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the absolute-path premise and total fallback, keeping use meaning separate from tags.
 * @evidence contracts/portability.md#os-neutral-implementation Realpath and case semantics come from the shared native boundary; unavailable case policy preserves missing spelling, and the total error fallback remains best-effort rather than a proved alias guarantee.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One fresh identity context owns call-local path/ancestor/case maps during resolution; native observations and any Windows case-query child belong to that delegated boundary. The context becomes reclaimable after success or caught failure, and only the returned path string escapes; this wrapper retains no historical registry or held directory handle.
 * @evidence contracts/performance.md#efficient-algorithms Delegated resolution traverses path ancestors and text and can scan native case-probe directory entries or invoke a Windows query; fixed wrapper steps do not bound that native work. Temporary context maps and returned spelling grow with observed paths and ancestors.
 * @evidence contracts/performance.md#reuse-equivalent-work The fresh context memoizes equivalent realpath/case observations within this call only. Later calls resolve current filesystem state again rather than reuse historical physical answers; the best-effort fallback is not an identity certificate.
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
