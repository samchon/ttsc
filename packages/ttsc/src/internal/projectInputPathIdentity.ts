import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type FilesystemPathIdentity = {
  key: string;
  path: string;
};

export type FilesystemPathIdentityOperations = {
  caseSensitive(directory: string): boolean;
  platform: NodeJS.Platform;
  realpath(location: string): string;
  throwOnRealpathError: boolean;
};

export type FilesystemPathIdentityContext = {
  caseSensitive(directory: string): boolean;
  isWithin(root: string, candidate: string): boolean;
  resolve(location: string): FilesystemPathIdentity;
};

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

/**
 * Create one filesystem-identity resolver for a filesystem transaction.
 *
 * Existing segments use their physical spelling. A missing suffix keeps exact
 * spelling only under a case-sensitive directory; otherwise its canonical
 * spelling is folded so aliases remain one declaration before they exist.
 */
export function createFilesystemPathIdentityContext(
  operations: Partial<FilesystemPathIdentityOperations> = {},
): FilesystemPathIdentityContext {
  const identities = new Map<string, CachedIdentity>();
  const realpaths = new Map<string, CachedRealpath>();
  const sensitivities = new Map<string, boolean>();
  const platform = operations.platform ?? process.platform;
  const pathApi = platform === "win32" ? path.win32 : path;
  const throwOnRealpathError = operations.throwOnRealpathError ?? true;
  const realpath = operations.realpath ?? physicalRealpath;
  const caseSensitive =
    operations.caseSensitive ??
    ((directory: string) =>
      filesystemDirectoryIsCaseSensitive(directory, platform));

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
        const sensitive =
          missing.length === 0
            ? true
            : cachedCaseSensitivity(sensitivities, caseSensitive, physical);
        const suffix = sensitive
          ? missing
          : missing.map((segment) => segment.toLowerCase());
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
            sensitive ? normalized : normalized.toLowerCase(),
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
      missing.unshift(pathApi.basename(existing));
      existing = parent;
    }
  };

  return {
    caseSensitive: (directory) => {
      const normalized = resolveFilesystemPath(directory, platform);
      resolve(normalized);
      return cachedCaseSensitivity(
        sensitivities,
        caseSensitive,
        identities.get(normalized)!.ancestor,
      );
    },
    isWithin: (root, candidate) =>
      isFilesystemPathIdentityWithin(
        resolve(root).key,
        resolve(candidate).key,
        platform,
      ),
    resolve,
  };
}

export function isFilesystemPathIdentityWithin(
  root: string,
  candidate: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (candidate === root) return true;
  const separator = platform === "win32" ? path.win32.sep : path.sep;
  return candidate.startsWith(
    root.endsWith(separator) ? root : `${root}${separator}`,
  );
}

export function resolveFilesystemPath(
  location: string,
  platform: NodeJS.Platform = process.platform,
): string {
  const pathApi = platform === "win32" ? path.win32 : path;
  if (platform !== "win32") {
    return pathApi.resolve(location);
  }
  const normalized = location.replaceAll("/", "\\");
  if (normalized.toLowerCase().startsWith("\\\\?\\unc\\")) {
    return pathApi.resolve(`\\\\${normalized.slice(8)}`);
  }
  if (
    normalized.startsWith("\\\\?\\") &&
    /^[A-Za-z]:\\/.test(normalized.slice(4))
  ) {
    return pathApi.resolve(normalized.slice(4));
  }
  return pathApi.resolve(normalized);
}

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
  cache: Map<string, boolean>,
  caseSensitive: (directory: string) => boolean,
  directory: string,
): boolean {
  const cached = cache.get(directory);
  if (cached !== undefined) return cached;
  const sensitive = caseSensitive(directory);
  cache.set(directory, sensitive);
  return sensitive;
}

function physicalRealpath(location: string): string {
  return fs.realpathSync.native?.(location) ?? fs.realpathSync(location);
}

function filesystemDirectoryIsCaseSensitive(
  directory: string,
  platform: NodeJS.Platform,
): boolean {
  let entries: string[];
  try {
    entries = fs.readdirSync(directory);
  } catch {
    return unprovenCaseSensitivity(platform);
  }
  const foldedNames = new Map<string, string>();
  for (const name of entries) {
    const folded = name.toLowerCase();
    const previous = foldedNames.get(folded);
    if (previous !== undefined && previous !== name) return true;
    foldedNames.set(folded, name);
  }
  let rejectedAlternate = false;
  for (const name of entries) {
    const alternate = alternateCase(name);
    if (alternate === name) continue;
    try {
      fs.lstatSync(path.join(directory, alternate));
      return false;
    } catch (error) {
      if (isMissingFilesystemEntry(error)) {
        rejectedAlternate = true;
        continue;
      }
      throw error;
    }
  }
  if (rejectedAlternate) return true;
  if (platform === "darwin") {
    // APFS/HFS case semantics are volume-wide. An empty directory has no child
    // name to probe, so ask the same read-only question of its existing name in
    // the parent and walk upward until a name with ASCII case is available.
    // This avoids a write probe while still distinguishing default APFS from a
    // case-sensitive volume.
    let current = resolveFilesystemPath(directory, platform);
    while (true) {
      const parent = path.dirname(current);
      if (parent === current) break;
      const name = path.basename(current);
      const alternate = alternateCase(name);
      if (alternate !== name) {
        try {
          physicalRealpath(path.join(parent, alternate));
          return false;
        } catch (error) {
          if (isMissingFilesystemEntry(error) === false) throw error;
        }
      }
      current = parent;
    }
    return unprovenCaseSensitivity(platform);
  }
  if (platform !== "win32") return true;
  // Node does not expose the Windows per-directory flag. Prefer fsutil's
  // read-only answer, then conservatively preserve distinct declarations.
  const queried = queryWindowsDirectoryCaseSensitivity(directory);
  if (queried !== undefined) return queried;
  return unprovenCaseSensitivity(platform);
}

/**
 * Read the per-directory flag without depending on fsutil's display language.
 *
 * English output is cheap to recognize directly. Other Windows locales write
 * console-code-page bytes that Node cannot reliably decode, so compare their
 * message suffix with the same query for the volume root. The root carries the
 * ordinary case-insensitive volume semantics and supplies the localized
 * "disabled" suffix without translating it or modifying the target.
 */
function queryWindowsDirectoryCaseSensitivity(
  directory: string,
): boolean | undefined {
  const result = queryWindowsDirectoryCaseSensitivityBytes(directory);
  if (result === undefined) return undefined;
  const text = result.toString("utf8");
  if (/\bdisabled\b/iu.test(text)) return false;
  if (/\benabled\b/iu.test(text)) return true;

  const volumeRoot = path.win32.parse(directory).root;
  const volume = queryWindowsDirectoryCaseSensitivityBytes(volumeRoot);
  if (volume === undefined) return undefined;
  const encodedRoot = Buffer.from(volumeRoot, "utf8");
  const rootOffset = volume.indexOf(encodedRoot);
  if (rootOffset === -1) return undefined;
  const disabledSuffix = volume.subarray(rootOffset + encodedRoot.length);
  if (disabledSuffix.length === 0 || result.length < disabledSuffix.length) {
    return undefined;
  }
  return !result
    .subarray(result.length - disabledSuffix.length)
    .equals(disabledSuffix);
}

function queryWindowsDirectoryCaseSensitivityBytes(
  directory: string,
): Buffer | undefined {
  const result = childProcess.spawnSync(
    "fsutil.exe",
    ["file", "queryCaseSensitiveInfo", directory],
    { windowsHide: true },
  );
  return result.error === undefined &&
    result.status === 0 &&
    Buffer.isBuffer(result.stdout)
    ? result.stdout
    : undefined;
}

/**
 * What to assume when the volume refused to answer.
 *
 * Every probe above returns a proof: two names that fold together prove the
 * volume keeps them apart, and a name that opens under the other case proves it
 * does not. This is the remaining case — an empty or unreadable directory, a
 * name with no letter to alter, a Windows build whose `fsutil` lacks the
 * subcommand — and the only honest answer is the platform's own default.
 *
 * NTFS and APFS are case-insensitive unless a volume or a directory was opted
 * out, so guessing sensitive there splits one file into two identities under
 * two spellings, which is the failure this module exists to remove. The rarer
 * mistake, on a volume that really was opted out, merges two files differing
 * only in case into one watched identity.
 */
function unprovenCaseSensitivity(platform: NodeJS.Platform): boolean {
  return platform !== "win32" && platform !== "darwin";
}

function filesystemPathIdentityKey(
  location: string,
  platform: NodeJS.Platform,
): string {
  if (platform !== "win32") return location;
  const root = path.win32.parse(location).root;
  return `${root.toLowerCase()}${location.slice(root.length)}`;
}

function alternateCase(value: string): string {
  return value.replace(/[A-Za-z]/g, (character) =>
    character === character.toLowerCase()
      ? character.toUpperCase()
      : character.toLowerCase(),
  );
}

function isMissingFilesystemEntry(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

export type ProjectInputPathIdentity = FilesystemPathIdentity;
export type ProjectInputPathIdentityOperations =
  FilesystemPathIdentityOperations;
export type ProjectInputPathIdentityContext = FilesystemPathIdentityContext;

export function createProjectInputPathIdentityContext(
  operations: Partial<ProjectInputPathIdentityOperations> = {},
): ProjectInputPathIdentityContext {
  return createFilesystemPathIdentityContext(operations);
}

export function isProjectInputPathIdentityWithin(
  root: string,
  candidate: string,
): boolean {
  return isFilesystemPathIdentityWithin(root, candidate);
}

export function resolveProjectInputPath(location: string): string {
  return resolveFilesystemPath(location);
}
