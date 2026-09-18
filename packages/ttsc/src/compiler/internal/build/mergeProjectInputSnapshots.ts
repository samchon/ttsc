import path from "node:path";

import { type ProjectInputPathIdentityContext } from "../../../internal/pathIdentity/ProjectInputPathIdentityContext";
import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";
import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";

/**
 * Merge the project-input snapshots of several plugins into one.
 *
 * Every snapshot must be anchored at the selected project root; a plugin that
 * resolved a different root is an error rather than a silent union. Entries are
 * deduplicated by filesystem identity, so aliases of one file collapse. The
 * spellings the plugins actually published survive under `declared` whenever
 * they differ from the normalized ones, because a watcher has to observe a
 * symlink itself, not only the file it currently points at.
 *
 * @param fallbackRoot The selected project root every snapshot must share.
 * @param identities Identity resolver for this merge; one is created when
 *   omitted.
 */
export function mergeProjectInputSnapshots(
  fallbackRoot: string,
  snapshots: readonly ITtscProjectInputSnapshot[],
  identities: ProjectInputPathIdentityContext = createProjectInputPathIdentityContext(),
): ITtscProjectInputSnapshot {
  const files = new Map<string, string>();
  const globs = new Map<string, string>();
  const reloadDirectories = new Map<string, string>();
  const reloadFiles = new Map<string, string>();
  // Deduplicated on the same identity keys, but holding what the contributors
  // wrote. Normalization resolves a declaration through its symlinks, which is
  // right for every comparison and wrong for the watcher that has to observe
  // the link itself being retargeted.
  const declaredFiles = new Map<string, string[]>();
  const declaredGlobs = new Map<string, string[]>();
  const declaredReloadDirectories = new Map<string, string[]>();
  const declaredReloadFiles = new Map<string, string[]>();
  const rootIdentity = identities.resolve(fallbackRoot);
  for (const snapshot of snapshots) {
    const candidateRoot = identities.resolve(snapshot.root);
    if (rootIdentity.key !== candidateRoot.key) {
      throw new Error(
        `ttsc.project-inputs: plugin root ${candidateRoot.path} differs from the selected project root ${rootIdentity.path}`,
      );
    }
    for (const file of snapshot.files) {
      const identity = identities.resolve(file);
      files.set(identity.key, identity.path);
      retainDeclaredSpelling(declaredFiles, identity.key, path.resolve(file));
    }
    for (const glob of snapshot.globs) {
      const identity = identities.resolve(glob);
      globs.set(identity.key, identity.path.split(path.sep).join("/"));
      retainDeclaredSpelling(
        declaredGlobs,
        identity.key,
        path.resolve(glob).split(path.sep).join("/"),
      );
    }
    for (const reloadFile of snapshot.reloadFiles ?? []) {
      const identity = identities.resolve(reloadFile);
      reloadFiles.set(identity.key, identity.path);
      retainDeclaredSpelling(
        declaredReloadFiles,
        identity.key,
        path.resolve(reloadFile),
      );
    }
    for (const reloadDirectory of snapshot.reloadDirectories ?? []) {
      const identity = identities.resolve(reloadDirectory);
      reloadDirectories.set(identity.key, identity.path);
      retainDeclaredSpelling(
        declaredReloadDirectories,
        identity.key,
        path.resolve(reloadDirectory),
      );
    }
  }
  const normalized = {
    root: rootIdentity.path,
    files: [...files.values()].sort(),
    globs: [...globs.values()].sort(),
    reloadDirectories: [...reloadDirectories.values()].sort(),
    reloadFiles: [...reloadFiles.values()].sort(),
  };
  const declared = {
    files: [...declaredFiles.values()].flat().sort(),
    globs: [...declaredGlobs.values()].flat().sort(),
    reloadDirectories: [...declaredReloadDirectories.values()].flat().sort(),
    reloadFiles: [...declaredReloadFiles.values()].flat().sort(),
  };
  // Carried only when it says something the normalized arrays do not. A tree
  // with no alias on any declaration produces the same four lists, and a
  // consumer that has to scan both would pay twice for one population.
  return arraysEqual(declared.files, normalized.files) &&
    arraysEqual(declared.globs, normalized.globs) &&
    arraysEqual(declared.reloadDirectories, normalized.reloadDirectories) &&
    arraysEqual(declared.reloadFiles, normalized.reloadFiles)
    ? normalized
    : { ...normalized, declared };
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length && left.every((item, i) => item === right[i])
  );
}

/**
 * Keep every declared spelling of one identity, ordered without regard to which
 * producer ran first.
 *
 * Two contributors can name the same file through different aliases, and each
 * alias is a path a watcher has to observe: keeping only one of them would
 * discard the link whose retarget the other spelling exists to catch. Insertion
 * order is not canonical, so the caller sorts the flattened result.
 */
function retainDeclaredSpelling(
  target: Map<string, string[]>,
  key: string,
  declared: string,
): void {
  const previous = target.get(key);
  if (previous === undefined) {
    target.set(key, [declared]);
    return;
  }
  if (previous.includes(declared)) return;
  previous.push(declared);
}
