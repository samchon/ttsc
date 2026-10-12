import fs from "node:fs";
import path from "node:path";

import type { FilesystemPathIdentity } from "./FilesystemPathIdentity";
import type { FilesystemPathIdentityContext } from "./FilesystemPathIdentityContext";
import type { FilesystemPathIdentityOperations } from "./FilesystemPathIdentityOperations";
import { createCaseSensitivityObservations } from "./createCaseSensitivityObservations";
import { isFilesystemPathIdentityWithin } from "./isFilesystemPathIdentityWithin";
import { resolveFilesystemPath } from "./resolveFilesystemPath";

/**
 * Create one filesystem-identity resolver for a filesystem transaction.
 *
 * Successfully observed prefixes use their physical spelling. An unresolved
 * suffix preserves spelling under sensitive or unknown policy; observed
 * insensitivity permits ASCII case folding. In best-effort mode that suffix can
 * include unreadable existing entries, so it is not proof of absence.
 *
 * Cached observations agree for the same queried key, not an atomic view of the
 * whole filesystem. An unavailable read-only case probe reports unknown and
 * preserves unresolved suffix spelling; only observed insensitivity permits
 * folding.
 *
 * @evidence contracts/common.md#principled-implementation Successful realpath observations establish physical prefixes; unresolved segments fold only under observed insensitivity, while sensitive or unknown ancestors preserve spelling. Best-effort unavailability does not establish absence or complete alias resolution, and unknown policy is not replaced with an OS-default equivalence assumption.
 * @evidence contracts/common.md#clear-and-simple-design A transaction owns resolution and three memoized observation maps; native case probing, lexical normalization and key construction are separate helpers with one identity policy shared by all callers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported injected operations replace no foreign methods; strict unexpected realpath failures propagate. Best-effort realpath is explicit, while unavailable case evidence remains unknown rather than a fabricated OS-default capability.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain missing-suffix semantics, per-key rather than atomic consistency and unknown case evidence; helpers document native probing premises, with separate tag paragraphs.
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath, alternate-name observations and read-only Windows fsutil obtain actual case evidence; native path APIs separate Windows and POSIX syntax. OS names select syntax or probe mechanisms, never an unmeasured directory policy.
 * @evidence contracts/performance.md#efficient-algorithms Construction allocates maps and closures without querying paths. Physical resolution visits missing ancestors and reverses the collected suffix once; lexical relations walk components. Default case probes enumerate uncapped immediate entries and inspect folded-name text, then stop at the first conclusive alternate-name observation. A rejected alternate is conclusive only when its original still exists; disappeared entries cannot establish sensitivity. Darwin can walk same-device ancestors, while Windows can synchronously launch directory and volume fsutil queries and parse returned bytes. Work includes visited path/name/output lengths and native metadata/process costs, not just depth or entry count.
 * @evidence contracts/performance.md#reuse-equivalent-work Each transaction memoizes resolved paths, realpath success or permitted-unavailable observations and case answers by their native keys; repeated questions reuse observations only within that unit of work, not across later filesystem generations. Best-effort cached unavailability is not an absence certificate.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Context-owned maps grow with queried paths and visited ancestors without internal eviction; reclamation requires the caller to release references to the context and its returned methods. Entry snapshots, decoded query text and synchronous fsutil results are transient rather than retained observers; no descriptor or child handle is held between completed observations. A Windows query supplies no explicit timeout, so active synchronous work has no deadline here. This boundary imposes no query-population quota or explicit dispose operation.
 */
export function createFilesystemPathIdentityContext(
  operations: Partial<FilesystemPathIdentityOperations> = {},
): FilesystemPathIdentityContext {
  const identities = new Map<string, CachedIdentity>();
  const realpaths = new Map<string, CachedRealpath>();
  const sensitivities = new Map<string, boolean | undefined>();
  const platform = operations.platform ?? process.platform;
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const throwOnRealpathError = operations.throwOnRealpathError ?? true;
  const realpath = operations.realpath ?? physicalRealpath;
  const lstat = operations.lstat ?? fs.lstatSync;
  const readdir = operations.readdir ?? fs.readdirSync;
  const caseSensitive =
    operations.caseSensitive ??
    createCaseSensitivityObservations({ lstat, platform, readdir, realpath });

  const resolve = (location: string): FilesystemPathIdentity => {
    const normalized = resolveFilesystemPath(location, platform);
    const cached = identities.get(normalized);
    if (cached !== undefined) return cached.identity;
    let existing = normalized;
    const missing: string[] = [];
    while (true) {
      const physical = cachedRealpath(
        realpaths,
        realpath,
        existing,
        platform,
        throwOnRealpathError,
      );
      if (physical !== undefined) {
        missing.reverse();
        const sensitive =
          missing.length === 0
            ? true
            : cachedCaseSensitivity(sensitivities, caseSensitive, physical);
        const suffix =
          sensitive === false ? missing.map(foldAsciiCase) : missing;
        const canonical = pathApi.resolve(physical, ...suffix);
        const identity = {
          key: filesystemPathIdentityKey(canonical, platform),
          path: canonical,
        };
        identities.set(normalized, {
          ancestor: physical,
          identity,
        });
        return identity;
      }
      const parent = pathApi.dirname(existing);
      if (parent === existing) {
        const sensitive = cachedCaseSensitivity(
          sensitivities,
          caseSensitive,
          existing,
        );
        const identity = {
          key: filesystemPathIdentityKey(
            sensitive === false ? foldAsciiCase(normalized) : normalized,
            platform,
          ),
          path: normalized,
        };
        identities.set(normalized, {
          ancestor: normalized,
          identity,
        });
        return identity;
      }
      missing.push(pathApi.basename(existing));
      existing = parent;
    }
  };

  const directoryCaseSensitive = (directory: string): boolean | undefined => {
    const normalized = resolveFilesystemPath(directory, platform);
    resolve(normalized);
    return cachedCaseSensitivity(
      sensitivities,
      caseSensitive,
      identities.get(normalized)!.ancestor,
    );
  };

  const lexicalParts = (
    location: string,
  ): { root: string; segments: string[] } => {
    const normalized = resolveFilesystemPath(location, platform);
    const root = pathApi.parse(normalized).root;
    return {
      root,
      segments: normalized
        .slice(root.length)
        .split(pathApi.sep)
        .filter(Boolean),
    };
  };

  // These candidates guide observation routing, not equality or cache proof.
  const lexicalRelation = (
    root: string,
    candidate: string,
    within: boolean,
  ): boolean => {
    const parent = lexicalParts(root);
    const child = lexicalParts(candidate);
    if (
      filesystemPathIdentityKey(parent.root, platform) !==
        filesystemPathIdentityKey(child.root, platform) ||
      (within
        ? parent.segments.length > child.segments.length
        : parent.segments.length !== child.segments.length)
    )
      return false;
    let directory = parent.root;
    for (let index = 0; index < parent.segments.length; index++) {
      const expected = parent.segments[index]!;
      const actual = child.segments[index]!;
      if (expected !== actual) {
        // Native Unicode case and normalization tables are not represented by
        // the ASCII probe. Keep such spellings eligible rather than inventing
        // a Unicode equivalence relation that could lose a watcher event.
        if (/^[\x00-\x7f]*$/.test(expected) && /^[\x00-\x7f]*$/.test(actual)) {
          if (
            directoryCaseSensitive(directory) === true ||
            foldAsciiCase(expected) !== foldAsciiCase(actual)
          )
            return false;
        }
      }
      directory = pathApi.join(directory, expected);
    }
    return true;
  };

  return {
    caseSensitive: directoryCaseSensitive,
    isWithin: (root, candidate) =>
      isFilesystemPathIdentityWithin(
        resolve(root).key,
        resolve(candidate).key,
        platform,
      ),
    lexicalKey: (location) => {
      const lexical = lexicalParts(location);
      let parent = lexical.root;
      const segments = lexical.segments.map((segment) => {
        const key =
          directoryCaseSensitive(parent) === false
            ? foldAsciiCase(segment)
            : segment;
        parent = pathApi.join(parent, segment);
        return key;
      });
      return pathApi.join(
        filesystemPathIdentityKey(lexical.root, platform),
        ...segments,
      );
    },
    lexicalMatches: (left, right) => lexicalRelation(left, right, false),
    lexicalIsWithin: (root, candidate) =>
      lexicalRelation(root, candidate, true),
    resolve,
  };
}

type CachedIdentity = {
  ancestor: string;
  identity: FilesystemPathIdentity;
};

type CachedRealpath =
  | {
      found: false;
    }
  | {
      found: true;
      path: string;
    };

function cachedRealpath(
  cache: Map<string, CachedRealpath>,
  realpath: (location: string) => string,
  location: string,
  platform: NodeJS.Platform,
  throwOnRealpathError: boolean,
): string | undefined {
  const cached = cache.get(location);
  if (cached !== undefined) return cached.found ? cached.path : undefined;
  try {
    const physical = resolveFilesystemPath(realpath(location), platform);
    cache.set(location, { found: true, path: physical });
    return physical;
  } catch (error) {
    if (throwOnRealpathError && isMissingFilesystemEntry(error) === false) {
      throw error;
    }
    cache.set(location, { found: false });
    return undefined;
  }
}

function cachedCaseSensitivity(
  cache: Map<string, boolean | undefined>,
  caseSensitive: (directory: string) => boolean | undefined,
  directory: string,
): boolean | undefined {
  if (cache.has(directory)) return cache.get(directory);
  const sensitive = caseSensitive(directory);
  cache.set(directory, sensitive);
  return sensitive;
}

function physicalRealpath(location: string): string {
  return fs.realpathSync.native?.(location) ?? fs.realpathSync(location);
}

function filesystemPathIdentityKey(
  location: string,
  platform: NodeJS.Platform,
): string {
  if (platform !== "win32") return location;
  const root = path.win32.parse(location).root;
  return `${root.toLowerCase()}${location.slice(root.length)}`;
}

/** ASCII folding is the case equivalence observed by the read-only probes. */
function foldAsciiCase(value: string): string {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

function isMissingFilesystemEntry(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}
