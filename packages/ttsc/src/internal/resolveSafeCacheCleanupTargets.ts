import fs from "node:fs";
import path from "node:path";

import { SourceNativeRetirement } from "./SourceNativeRetirement";

import type { SafeCacheCleanupTarget } from "./SafeCacheCleanupTarget";
import { type FilesystemPathIdentityOperations } from "./pathIdentity/FilesystemPathIdentityOperations";
import { createFilesystemPathIdentityContext } from "./pathIdentity/createFilesystemPathIdentityContext";
import { resolveFilesystemPath } from "./pathIdentity/resolveFilesystemPath";

/**
 * Resolve one cache-clean transaction to physical deletion targets.
 *
 * Every target is checked before the caller removes the first one. Existing
 * aliases are pinned to their physical spelling, while a missing suffix keeps
 * the identity of its nearest existing parent. Identity errors other than a
 * genuinely missing path fail closed.
 *
 * Candidates overlapping protected directories are omitted from deletion. This
 * preserves caller-owned caches even when another cleanup selector names their
 * ancestor or descendant; uncertain case or Unicode overlap also preserves a
 * candidate instead of authorizing deletion.
 *
 * Native-retirement guards in selected trees or their enclosing resource roots
 * refuse the entire transaction before deletion. Terminal links retain their
 * unlink-only semantics and do not traverse a guarded destination.
 *
 * The plan contains observed path spellings, not held directory handles or an
 * atomic namespace snapshot. Pinning an ancestor alias does not prevent later
 * replacement of the selected physical parent or terminal entry; callers must
 * preserve that ownership boundary while using the returned plan.
 *
 * @evidence contracts/common.md#principled-implementation Every requested target is physically pinned and validated before return; roots and project-containing directories fail closed, while bidirectional overlap preserves caller-protected directories and unrelated candidates remain eligible.
 * @evidence contracts/common.md#clear-and-simple-design One transaction owns identity proof, terminal-link deletion semantics and protected overlap policy for API and CLI consumers; deletion itself remains with the caller after all candidates are resolved.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Protection follows native identities rather than special cache names; aliases are resolved through supported primitives and unexpected identity errors cannot authorize deletion.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain validation-before-deletion, failure behavior and protected preservation; inline comments describe why ancestors are pinned and terminal links remain links.
 * @evidence contracts/portability.md#os-neutral-implementation The shared native resolver handles physical aliases, volume roots and actual directory case policy; Node lstat identifies terminal links, while unknown missing suffix policy preserves spellings rather than asserting case-variant identity.
 * @evidence contracts/performance.md#efficient-algorithms Resolving the project, P protected paths and C candidates requires path/ancestor observations independently of the overlap loop. Candidate/project checks and at most two comparisons per protected path add O(C(P+1)D) component comparisons for depth D, plus path text and delegated native realpath/stat/case-probe work; selected directory trees are scanned for native guards before the transaction returns; case probes can scan observed directory entries. Context memoization shares equivalent observations within this call; no cross-run index is built for this cleanup set.
 * @evidence contracts/performance.md#reuse-equivalent-work All candidate and protected paths share one identity context, so equivalent ancestor realpath and case queries reuse the same transaction observations; deletion results themselves are not cached across mutable filesystem states.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Context maps retain observed identities, ancestors and case facts for this call, growing with distinct queried paths/ancestors and their text; protected identities use O(P) references and returned targets at most O(C). No directory handle is held; the context becomes reclaimable after return, while the caller owns retained plan strings and later deletion under a preserved namespace boundary.
 */
export function resolveSafeCacheCleanupTargets(
  projectRoot: string,
  cacheDirectories: readonly string[],
  operations: Partial<FilesystemPathIdentityOperations> = {},
  protectedDirectories: readonly string[] = [],
): SafeCacheCleanupTarget[] {
  const identities = createFilesystemPathIdentityContext(operations);
  const lstat = operations.lstat ?? fs.lstatSync;
  const project = identities.resolve(projectRoot);
  const protectedIdentities = protectedDirectories.map((directory) =>
    identities.resolve(directory),
  );
  const targets: SafeCacheCleanupTarget[] = [];
  for (const cacheDirectory of cacheDirectories) {
    const requestedCache = resolveFilesystemPath(cacheDirectory);
    // Fix every mutable alias ancestor before inspecting the terminal entry.
    // All later identity checks and deletion paths use this physical-parent
    // candidate rather than following the original lexical ancestor again.
    // No held handle prevents replacement of that physical namespace itself.
    const pinnedCache = path.join(
      identities.resolve(path.dirname(requestedCache)).path,
      path.basename(requestedCache),
    );
    const cache = identities.resolve(pinnedCache);
    if (
      requestedCache === path.parse(requestedCache).root ||
      cache.path === path.parse(cache.path).root
    ) {
      throw new Error(
        `ttsc: refusing to clean cache directory ${JSON.stringify(requestedCache)} because filesystem roots are never valid cache directories`,
      );
    }
    if (identities.lexicalIsWithin(cache.path, project.path)) {
      throw new Error(
        `ttsc: refusing to clean cache directory ${JSON.stringify(requestedCache)} because it equals or contains project root ${JSON.stringify(project.path)}; choose a dedicated cache directory`,
      );
    }
    if (
      protectedIdentities.some(
        (protectedDirectory) =>
          identities.lexicalIsWithin(protectedDirectory.path, cache.path) ||
          identities.lexicalIsWithin(cache.path, protectedDirectory.path),
      )
    )
      continue;
    const status = lstatIfPresent(pinnedCache, lstat);
    // Recursive rm removes a terminal symlink or junction itself rather than
    // following it. Preserve that behavior while pinning any mutable alias in
    // its ancestors to the physical parent selected by this transaction.
    const deletionPath = status?.isSymbolicLink() ? pinnedCache : cache.path;
    SourceNativeRetirement.assertCleanable(deletionPath);
    targets.push({
      exists: status !== undefined,
      path: deletionPath,
      requestedPath: requestedCache,
    });
  }
  return targets;
}

function lstatIfPresent(
  location: string,
  lstat: NonNullable<FilesystemPathIdentityOperations["lstat"]>,
): fs.Stats | fs.BigIntStats | undefined {
  try {
    return lstat(location);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    ) {
      return undefined;
    }
    throw error;
  }
}
