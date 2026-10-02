import path from "node:path";

/**
 * Whether `candidate` equals `root` or lies beneath it, compared lexically.
 *
 * Both arguments must already be identity keys (see
 * {@link FilesystemPathIdentity.key}). The function performs no filesystem
 * access and no case folding, which is what makes it cheap enough to call per
 * watcher event. A root that already ends in a separator (a volume root such as
 * `C:\` or `/`) is used as is, so every path on that volume is inside it.
 *
 * @param platform Separator semantics; defaults to the host platform.
 *
 * @evidence contracts/common.md#principled-implementation Equality includes the root itself and a separator-delimited prefix includes only descendants; inputs must already carry canonical identity keys so sibling names and case policy are not guessed here.
 * @evidence contracts/common.md#clear-and-simple-design One equality check and one boundary prefix check keep this lexical predicate separate from the resolver that proves keys.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The volume-root separator rule is path syntax required by containment, not an expected-result exception or a casing workaround.
 * @evidence contracts/common.md#meaningful-documentation Native prose documents the canonical-key premise, no filesystem access and volume-root behavior, which callers need to avoid treating raw paths as identities.
 * @evidence contracts/portability.md#os-neutral-implementation Explicit platform separators preserve drive, UNC and POSIX root boundaries; existing keys supply native case policy rather than whole-path lowercasing here.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources isFilesystemPathIdentityWithin declares a signature only; the implementation owns acquisition and release of resources.
 * @evidenceExclude contracts/performance.md#efficient-algorithms isFilesystemPathIdentityWithin declares a signature only; the implementation owns the processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work isFilesystemPathIdentityWithin declares a signature only; the implementation owns any shared work.
 */
export function isFilesystemPathIdentityWithin(
  root: string,
  candidate: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (candidate === root) return true;
  const separator = platform === "win32" ? path.win32.sep : path.posix.sep;
  return candidate.startsWith(
    root.endsWith(separator) ? root : `${root}${separator}`,
  );
}
