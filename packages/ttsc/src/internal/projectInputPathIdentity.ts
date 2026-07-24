import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type ProjectInputPathIdentity = {
  key: string;
  path: string;
};

export type ProjectInputPathIdentityOperations = {
  caseSensitive(directory: string): boolean;
  realpath(location: string): string;
};

export type ProjectInputPathIdentityContext = {
  caseSensitive(directory: string): boolean;
  isWithin(root: string, candidate: string): boolean;
  resolve(location: string): ProjectInputPathIdentity;
};

type CachedIdentity = {
  ancestor: string;
  identity: ProjectInputPathIdentity;
};

type CachedRealpath =
  | {
      found: false;
    }
  | {
      found: true;
      path: string;
    };

const CASE_SENSITIVITY_PROBE_PREFIX = ".ttsc-project-input-case-probe-";
const CASE_SENSITIVITY_PROBE_SUFFIX = "-Aa.ttsc-probe";

/**
 * Create one filesystem-identity resolver for a project-input transaction.
 *
 * Existing segments use their physical spelling. A missing suffix keeps exact
 * spelling only under a case-sensitive directory; otherwise its canonical
 * spelling is folded so aliases remain one declaration before they exist.
 */
export function createProjectInputPathIdentityContext(
  operations: Partial<ProjectInputPathIdentityOperations> = {},
): ProjectInputPathIdentityContext {
  const identities = new Map<string, CachedIdentity>();
  const realpaths = new Map<string, CachedRealpath>();
  const sensitivities = new Map<string, boolean>();
  const realpath = operations.realpath ?? physicalRealpath;
  const caseSensitive =
    operations.caseSensitive ?? filesystemDirectoryIsCaseSensitive;

  const resolve = (location: string): ProjectInputPathIdentity => {
    const normalized = resolveProjectInputPath(location);
    const cached = identities.get(normalized);
    if (cached !== undefined) return cached.identity;
    let existing = normalized;
    const missing: string[] = [];
    while (true) {
      const physical = cachedRealpath(realpaths, realpath, existing);
      if (physical !== undefined) {
        const sensitive =
          missing.length === 0
            ? true
            : cachedCaseSensitivity(sensitivities, caseSensitive, physical);
        const suffix = sensitive
          ? missing
          : missing.map((segment) => segment.toLowerCase());
        const canonical = path.resolve(physical, ...suffix);
        const identity = {
          key: canonical,
          path: canonical,
        };
        identities.set(normalized, {
          ancestor: physical,
          identity,
        });
        return identity;
      }
      const parent = path.dirname(existing);
      if (parent === existing) {
        const identity = {
          key: normalized,
          path: normalized,
        };
        identities.set(normalized, {
          ancestor: normalized,
          identity,
        });
        return identity;
      }
      missing.unshift(path.basename(existing));
      existing = parent;
    }
  };

  return {
    caseSensitive: (directory) => {
      const normalized = resolveProjectInputPath(directory);
      resolve(normalized);
      return cachedCaseSensitivity(
        sensitivities,
        caseSensitive,
        identities.get(normalized)!.ancestor,
      );
    },
    isWithin: (root, candidate) =>
      isProjectInputPathIdentityWithin(
        resolve(root).key,
        resolve(candidate).key,
      ),
    resolve,
  };
}

export function isProjectInputPathIdentityWithin(
  root: string,
  candidate: string,
): boolean {
  if (candidate === root) return true;
  return candidate.startsWith(
    root.endsWith(path.sep) ? root : `${root}${path.sep}`,
  );
}

export function resolveProjectInputPath(location: string): string {
  if (process.platform !== "win32") {
    return path.resolve(location);
  }
  const normalized = location.replaceAll("/", "\\");
  if (normalized.toLowerCase().startsWith("\\\\?\\unc\\")) {
    return path.resolve(`\\\\${normalized.slice(8)}`);
  }
  if (
    normalized.startsWith("\\\\?\\") &&
    /^[A-Za-z]:\\/.test(normalized.slice(4))
  ) {
    return path.resolve(normalized.slice(4));
  }
  return path.resolve(normalized);
}

function cachedRealpath(
  cache: Map<string, CachedRealpath>,
  realpath: (location: string) => string,
  location: string,
): string | undefined {
  const cached = cache.get(location);
  if (cached !== undefined) return cached.found ? cached.path : undefined;
  try {
    const physical = resolveProjectInputPath(realpath(location));
    cache.set(location, { found: true, path: physical });
    return physical;
  } catch (error) {
    if (isMissingFilesystemEntry(error) === false) throw error;
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

function filesystemDirectoryIsCaseSensitive(directory: string): boolean {
  let entries: string[];
  try {
    entries = fs.readdirSync(directory);
  } catch {
    return true;
  }
  const foldedNames = new Map<string, string>();
  for (const name of entries) {
    const folded = name.toLowerCase();
    const previous = foldedNames.get(folded);
    if (previous !== undefined && previous !== name) return true;
    foldedNames.set(folded, name);
  }
  if (process.platform !== "win32") {
    for (const name of entries) {
      const alternate = alternateCase(name);
      if (alternate === name) continue;
      try {
        physicalRealpath(path.join(directory, alternate));
        return false;
      } catch (error) {
        if (isMissingFilesystemEntry(error)) return true;
        throw error;
      }
    }
    return true;
  }
  // Node does not expose the Windows per-directory flag. Prefer fsutil's
  // read-only answer, then fall back to a locale-independent sentinel probe.
  const result = childProcess.spawnSync(
    "fsutil.exe",
    ["file", "queryCaseSensitiveInfo", directory],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.error === undefined && result.status === 0) {
    if (/\bdisabled\b/iu.test(result.stdout)) return false;
    if (/\benabled\b/iu.test(result.stdout)) return true;
  }
  return probeProjectInputDirectoryCaseSensitivity(directory);
}

export function probeProjectInputDirectoryCaseSensitivity(
  directory: string,
): boolean {
  const basename = `${CASE_SENSITIVITY_PROBE_PREFIX}${crypto.randomUUID()}${CASE_SENSITIVITY_PROBE_SUFFIX}`;
  const exact = path.join(directory, basename);
  const alternate = path.join(directory, alternateCase(basename));
  let exactCreated = false;
  let exactDescriptor: number | undefined;
  let alternateCreated = false;
  let alternateDescriptor: number | undefined;
  let sensitive = true;
  try {
    exactDescriptor = fs.openSync(exact, "wx");
    exactCreated = true;
    fs.closeSync(exactDescriptor);
    exactDescriptor = undefined;
    try {
      alternateDescriptor = fs.openSync(alternate, "wx");
      alternateCreated = true;
    } catch (error) {
      sensitive = isFilesystemEntryExists(error) === false;
    }
  } catch {
    sensitive = true;
  } finally {
    if (alternateDescriptor !== undefined) {
      try {
        fs.closeSync(alternateDescriptor);
      } catch {
        sensitive = true;
      }
    }
    if (exactDescriptor !== undefined) {
      try {
        fs.closeSync(exactDescriptor);
      } catch {
        sensitive = true;
      }
    }
    if (alternateCreated) {
      try {
        fs.unlinkSync(alternate);
      } catch {
        sensitive = true;
      }
    }
    if (exactCreated) {
      try {
        fs.unlinkSync(exact);
      } catch {
        sensitive = true;
      }
    }
  }
  return sensitive;
}

function isFilesystemEntryExists(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
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
