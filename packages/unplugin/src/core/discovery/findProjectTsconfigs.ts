import fs from "node:fs";
import path from "node:path";

import type { TtscProjectTreeDiscoveryFilesystem } from "./TtscProjectTreeDiscoveryFilesystem";
import { canonicalProjectPath } from "./canonicalProjectPath";
import { isIgnoredProjectDirectory } from "./isIgnoredProjectDirectory";
import { projectDirectoryIdentity } from "./projectDirectoryIdentity";

const HOST_PROJECT_TREE_DISCOVERY_FILESYSTEM: TtscProjectTreeDiscoveryFilesystem =
  Object.freeze({
    readdir: (location: string) =>
      fs.readdirSync(location, { withFileTypes: true }),
    realpath: fs.realpathSync.native,
    stat: fs.statSync,
  });

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
