import path from "node:path";

import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import { createFilesystemPathIdentityContext } from "../../../internal/pathIdentity/createFilesystemPathIdentityContext";
import { isFilesystemPathIdentityWithin } from "../../../internal/pathIdentity/isFilesystemPathIdentityWithin";
import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";
import { resolveSourceBuildCachePaths } from "./resolveSourceBuildCachePaths";

/**
 * Return every directory `ttsc clean` should remove for `projectRoot`.
 *
 * Covers the resolved plugin-binary root, the single-file caches beside it
 * (descriptor evaluations, capability answers, lowered orphan sources:
 * `SourceBuildCacheLayout.CACHE_FILE_DIRNAMES`), a safely named nested
 * `go-build/`, a ttsc-owned Go build cache that lives OUTSIDE that root
 * (`TTSC_GO_CACHE_DIR`), and the two legacy project-local caches. A
 * user-provided `GOCACHE` filters candidates whose reported identity keys
 * overlap in either direction. This query does not pin those paths or certify
 * unresolved case/alias relationships; the cleanup transaction validates the
 * complete deletion set separately. Workspace discovery reads the filesystem;
 * environment selection uses `env` so a programmatic caller can supply its
 * effective environment.
 *
 * @evidence contracts/common.md#principled-implementation Candidate directories encode owned layout parts and dedicated Go provenance; reported identity-key overlap with external GOCACHE is excluded in either ancestor direction, without converting unresolved identity into a physical-ownership certificate.
 * @evidence contracts/common.md#clear-and-simple-design Candidate enumeration is followed by one external-ownership filter; physical deletion and project-root protection remain the cleanup transaction's responsibility.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Legacy paths are supported migration targets; external Go storage is protected by identity rather than guessed different spellings.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state candidate ownership, filesystem discovery and injected environment semantics rather than claiming a pure query.
 * @evidence contracts/portability.md#os-neutral-implementation Native path APIs construct candidates; environment lookup honors Windows case-insensitive names, and the shared identity context resolves aliases and actual directory case semantics for overlap protection.
 * @evidence contracts/performance.md#efficient-algorithms The candidate count is fixed, but delegated default root discovery walks ancestors, reads manifest bytes and inspects layout entry populations. Path/environment text and native identity/case observations contribute cost; one call-local identity context shares repeated resolution across overlap checks without a constant-cost filesystem claim.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Cleanup candidate selection does not establish equivalence for computed build answers.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The query returns candidates; the cleanup transaction owns deletion and no retained handle is acquired here.
 */
export function resolveCleanTargets(
  projectRoot: string,
  cacheDir?: string,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const paths = resolveSourceBuildCachePaths(projectRoot, cacheDir, env);
  // Remove ttsc-OWNED directories only, never the parent cache root.
  const targets = [
    paths.pluginRoot,
    ...SourceBuildCacheLayout.CACHE_FILE_DIRNAMES.map((name) =>
      path.join(paths.root, name),
    ),
  ];
  // ttsc's nested `<root>/go-build` is only safe to delete when we are certain
  // the root belongs to ttsc: the default `node_modules/.cache/ttsc`, or a root
  // the user explicitly named `ttsc`. Under a shared root (e.g.
  // `TTSC_CACHE_DIR=~/.cache`) a bare `<root>/go-build` could be the user's
  // machine-wide GOCACHE, so it must never be removed by name.
  const isTtscOwnedRoot =
    (!cacheDir && !SidecarEnvironment.read(env, "TTSC_CACHE_DIR")) ||
    path.basename(paths.root) === SourceBuildCacheLayout.TTSC_CACHE_DIRNAME;
  if (isTtscOwnedRoot) {
    targets.push(
      path.join(paths.root, SourceBuildCacheLayout.GO_BUILD_CACHE_DIRNAME),
    );
  }
  // An explicit TTSC_GO_CACHE_DIR is a ttsc-dedicated external cache; a
  // user-provided GOCACHE (source "GOCACHE") is never removed.
  if (paths.goBuildRootSource === "TTSC_GO_CACHE_DIR") {
    targets.push(paths.goBuildRoot);
  }
  targets.push(
    path.join(
      projectRoot,
      SourceBuildCacheLayout.NODE_MODULES_DIRNAME,
      ".ttsc",
    ),
  );
  targets.push(path.join(projectRoot, ".ttsc"));
  const externalGoCache = SidecarEnvironment.read(env, "GOCACHE");
  if (!externalGoCache) return targets;
  const identities = createFilesystemPathIdentityContext();
  const external = identities.resolve(externalGoCache);
  return targets.filter((target) => {
    const candidate = identities.resolve(target);
    return (
      !isFilesystemPathIdentityWithin(candidate.key, external.key) &&
      !isFilesystemPathIdentityWithin(external.key, candidate.key)
    );
  });
}
