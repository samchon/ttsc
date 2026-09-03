import fs from "node:fs";
import path from "node:path";

/** Filesystem facts required to discover an implicit TypeScript project. */
export interface TtscProjectDiscoveryFilesystem {
  /** Override path parsing when the observed filesystem is not the host. */
  platform?: NodeJS.Platform;
  /** Read metadata while following links, like an ordinary config-file open. */
  stat(location: string): Pick<fs.Stats, "isFile">;
}

/** Directory enumeration required to discover every implicit child project. */
export interface TtscProjectTreeDiscoveryFilesystem extends TtscProjectDiscoveryFilesystem {
  /** Enumerate one lexical directory without following child directory links. */
  readdir(location: string): readonly Pick<fs.Dirent, "isDirectory" | "name">[];
}

const HOST_PROJECT_DISCOVERY_FILESYSTEM: TtscProjectDiscoveryFilesystem =
  Object.freeze({
    stat: fs.statSync,
  });

const HOST_PROJECT_TREE_DISCOVERY_FILESYSTEM: TtscProjectTreeDiscoveryFilesystem =
  Object.freeze({
    readdir: (location: string) =>
      fs.readdirSync(location, { withFileTypes: true }),
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
  const paths =
    filesystem.platform === undefined
      ? path
      : filesystem.platform === "win32"
        ? path.win32
        : path.posix;
  let current = paths.resolve(startDirectory);
  while (true) {
    const candidate = paths.join(current, "tsconfig.json");
    try {
      if (filesystem.stat(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // An implicit candidate is selectable only when its file kind is proven.
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
 * The traversal follows the same lexical directory boundary as the project
 * input walk, while `stat` follows a config-file link exactly as nearest
 * discovery does. An incomplete directory traversal is reported rather than
 * returned as a complete project map, so a cache-key caller can refuse reuse.
 */
export function findProjectTsconfigs(
  root: string,
  filesystem: TtscProjectTreeDiscoveryFilesystem = HOST_PROJECT_TREE_DISCOVERY_FILESYSTEM,
): { complete: boolean; files: string[] } {
  const paths =
    filesystem.platform === undefined
      ? path
      : filesystem.platform === "win32"
        ? path.win32
        : path.posix;
  const pending = [paths.resolve(root)];
  const files: string[] = [];
  let complete = true;
  while (pending.length !== 0) {
    const directory = pending.pop()!;
    let entries: readonly Pick<fs.Dirent, "isDirectory" | "name">[];
    try {
      entries = filesystem.readdir(directory);
    } catch {
      complete = false;
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !isIgnoredProjectDirectory(entry.name)) {
        pending.push(paths.join(directory, entry.name));
      }
    }
    const candidate = paths.join(directory, "tsconfig.json");
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
  files.sort();
  return { complete, files };
}
