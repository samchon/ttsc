import fs from "node:fs";
import path from "node:path";

/** Filesystem facts required to discover an implicit TypeScript project. */
export interface TtscProjectDiscoveryFilesystem {
  /** Override path parsing when the observed filesystem is not the host. */
  platform?: NodeJS.Platform;
  /** Read metadata while following links, like an ordinary config-file open. */
  stat(
    location: string,
  ): Pick<fs.Stats, "isFile"> & Partial<Pick<fs.Stats, "isDirectory">>;
}

/** Directory enumeration required to discover every implicit child project. */
export interface TtscProjectTreeDiscoveryFilesystem extends TtscProjectDiscoveryFilesystem {
  /** Enumerate one lexical directory and identify child directory links. */
  readdir(
    location: string,
  ): readonly (Pick<fs.Dirent, "isDirectory" | "name"> &
    Partial<Pick<fs.Dirent, "isSymbolicLink">>)[];
  /** Resolve physical directory identity for cycle-safe linked traversal. */
  realpath?(location: string): string;
}

/** One exact file predicate consulted by nearest-project discovery. */
export interface TtscProjectTsconfigCandidate {
  readonly file: string;
  readonly fileExists: boolean;
}

/** The selected config and the predicates that selected it. */
export interface TtscProjectTsconfigDiscovery {
  readonly candidates: readonly TtscProjectTsconfigCandidate[];
  readonly file: string | undefined;
}

const HOST_PROJECT_DISCOVERY_FILESYSTEM: TtscProjectDiscoveryFilesystem =
  Object.freeze({
    stat: fs.statSync,
  });

const HOST_PROJECT_TREE_DISCOVERY_FILESYSTEM: TtscProjectTreeDiscoveryFilesystem =
  Object.freeze({
    readdir: (location: string) =>
      fs.readdirSync(location, { withFileTypes: true }),
    realpath: fs.realpathSync.native,
    stat: fs.statSync,
  });

/** Directories deliberately outside the shared lexical project walk. */
export function isIgnoredProjectDirectory(name: string): boolean {
  // The residue of what used to be a fifteen-name list, kept to the VCS store,
  // the package manager's tree, and ttsc's own plugin cache. Everything else
  // is decided by the resolved project policy rather than a directory-name
  // guess (samchon/ttsc#1307).
  return name === ".git" || name === ".ttsc" || name === "node_modules";
}

/**
 * Find the nearest ancestor `tsconfig.json` that is proven to be a file.
 *
 * A directory, broken link, permission failure, or any other unprovable
 * candidate cannot terminate the walk. `stat` deliberately follows links, so a
 * link to a regular file retains its lexical config spelling.
 */
export function findNearestProjectTsconfig(
  startDirectory: string,
  filesystem: TtscProjectDiscoveryFilesystem = HOST_PROJECT_DISCOVERY_FILESYSTEM,
): string | undefined {
  return findNearestProjectTsconfigImpl(startDirectory, filesystem);
}

/**
 * Find the nearest config and retain the exact predicate observations used to
 * select it. A cache host must not rediscover these candidates later: a file
 * can disappear only for selection and return before that second observation.
 */
export function discoverNearestProjectTsconfig(
  startDirectory: string,
  filesystem: TtscProjectDiscoveryFilesystem = HOST_PROJECT_DISCOVERY_FILESYSTEM,
): TtscProjectTsconfigDiscovery {
  const candidates: TtscProjectTsconfigCandidate[] = [];
  return {
    candidates,
    file: findNearestProjectTsconfigImpl(
      startDirectory,
      filesystem,
      candidates,
    ),
  };
}

/** Shared walk with optional observation retention for cache hosts. */
function findNearestProjectTsconfigImpl(
  startDirectory: string,
  filesystem: TtscProjectDiscoveryFilesystem,
  candidates?: TtscProjectTsconfigCandidate[],
): string | undefined {
  const paths =
    filesystem.platform === undefined
      ? path
      : filesystem.platform === "win32"
        ? path.win32
        : path.posix;
  let current = paths.resolve(startDirectory);
  while (true) {
    const candidate = paths.join(current, "tsconfig.json");
    let fileExists = false;
    try {
      fileExists = filesystem.stat(candidate).isFile();
    } catch {
      // An implicit candidate is selectable only when its file kind is proven.
    }
    candidates?.push({ file: candidate, fileExists });
    if (fileExists) {
      return candidate;
    }
    const parent = paths.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

/**
 * Find every regular `tsconfig.json` below one project root.
 *
 * The traversal retains lexical project spellings while following child
 * directory links and junctions. A physical ancestor set cuts cycles without
 * collapsing two independent aliases of the same project. An incomplete
 * traversal is reported rather than returned as a complete project map, so a
 * cache-key caller can refuse reuse.
 */
export function findProjectTsconfigs(
  root: string,
  filesystem: TtscProjectTreeDiscoveryFilesystem = HOST_PROJECT_TREE_DISCOVERY_FILESYSTEM,
): { candidates: string[]; complete: boolean; files: string[] } {
  const paths =
    filesystem.platform === undefined
      ? path
      : filesystem.platform === "win32"
        ? path.win32
        : path.posix;
  type PendingDirectory = {
    ancestors: ReadonlySet<string>;
    directory: string;
    physicalAncestorsComplete: boolean;
  };
  const rootDirectory = paths.resolve(root);
  const rootIdentity = projectDirectoryIdentity(
    rootDirectory,
    filesystem,
    paths,
  );
  const pending: PendingDirectory[] = [
    {
      ancestors: new Set([
        rootIdentity ??
          canonicalProjectPath(rootDirectory, filesystem.platform),
      ]),
      directory: rootDirectory,
      physicalAncestorsComplete:
        filesystem.realpath === undefined || rootIdentity !== undefined,
    },
  ];
  const candidates: string[] = [];
  const files: string[] = [];
  let complete =
    filesystem.realpath === undefined || rootIdentity !== undefined;
  while (pending.length !== 0) {
    const current = pending.pop()!;
    const directory = current.directory;
    let entries: readonly (Pick<fs.Dirent, "isDirectory" | "name"> &
      Partial<Pick<fs.Dirent, "isSymbolicLink">>)[];
    try {
      entries = filesystem.readdir(directory);
    } catch {
      complete = false;
      continue;
    }
    for (const entry of entries) {
      if (isIgnoredProjectDirectory(entry.name)) continue;
      const child = paths.join(directory, entry.name);
      const linked = entry.isSymbolicLink?.() === true;
      let directoryEntry = entry.isDirectory();
      if (!directoryEntry && linked) {
        try {
          directoryEntry = filesystem.stat(child).isDirectory?.() === true;
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code !== "ENOENT" && code !== "ENOTDIR") complete = false;
          continue;
        }
      }
      if (!directoryEntry) continue;
      const identity = projectDirectoryIdentity(child, filesystem, paths);
      const physicalAncestorsComplete =
        current.physicalAncestorsComplete &&
        (filesystem.realpath === undefined || identity !== undefined);
      if (filesystem.realpath !== undefined && identity === undefined) {
        complete = false;
      }
      if (linked && (identity === undefined || !physicalAncestorsComplete)) {
        complete = false;
        continue;
      }
      const stableIdentity =
        identity ?? canonicalProjectPath(child, filesystem.platform);
      if (current.ancestors.has(stableIdentity)) continue;
      pending.push({
        ancestors: new Set([...current.ancestors, stableIdentity]),
        directory: child,
        physicalAncestorsComplete,
      });
    }
    const candidate = paths.join(directory, "tsconfig.json");
    candidates.push(candidate);
    try {
      if (filesystem.stat(candidate).isFile()) {
        files.push(candidate);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") {
        complete = false;
      }
    }
  }
  candidates.sort();
  files.sort();
  return { candidates, complete, files };
}

function projectDirectoryIdentity(
  directory: string,
  filesystem: TtscProjectTreeDiscoveryFilesystem,
  paths: typeof path.posix | typeof path.win32,
): string | undefined {
  if (filesystem.realpath === undefined) return undefined;
  try {
    return canonicalProjectPath(
      paths.resolve(filesystem.realpath(directory)),
      filesystem.platform,
    );
  } catch {
    return undefined;
  }
}

function canonicalProjectPath(
  location: string,
  platform: NodeJS.Platform | undefined,
): string {
  return platform === "win32" ? location.toLowerCase() : location;
}
