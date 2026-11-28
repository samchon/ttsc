import path from "node:path";

import { PluginContentIdentities } from "../plugin/internal/source/PluginContentIdentities";
import { resolveSourceBuildCachePaths } from "../plugin/internal/source/resolveSourceBuildCachePaths";
import { selectedRecordIdentityTempParent } from "../plugin/internal/source/selectedRecordIdentityTempParent";
import { createCanonicalTempDirectory } from "./createCanonicalTempDirectory";
import { systemTempOutsideProject } from "./systemTempOutsideProject";

/**
 * Allocate below a system temp parent qualified against the operation's project
 * roots and the invoking process. A consumer without a project root, such as an
 * orphan emit in a runtime without a manifest, relies on the native selector to
 * exclude marked project directories.
 *
 * A project marker in the ancestry of every system temp parent disqualifies all
 * of them, as a `package.json` in the account's home directory does for Windows
 * TEMP, or a project at a container's volume root does for `/tmp`. The
 * project's record store then supplies its `identities` directory, the ignored
 * `node_modules/.cache/ttsc` parent that descriptor evaluation and output
 * capture already use. Without a project root or such a store, the allocation
 * fails.
 *
 * A failed postflight can leave an allocation whose ownership was unproven.
 *
 * @evidence contracts/common.md#principled-implementation A project consumer supplies the project it actually read, including a custom config outside the process cwd. A projectless consumer relies on the selector's project markers. When no system parent qualifies, the record store selected for the project supplies the private parent that the store's ownership checks admit.
 * @evidence contracts/common.md#clear-and-simple-design The system selector owns placement, the record store owns its fallback root and the canonical creator owns allocation and postflight.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Ambient temp must pass the same project-boundary check as each platform fallback. The fallback is the store's existing private parent, not a new location inside the project.
 * @evidence contracts/common.md#meaningful-documentation Identifies the operation roots, the fallback owner, the failure case and the allocation owner.
 * @evidence contracts/portability.md#os-neutral-implementation Delegates native containment, aliases and platform candidates to the system selector, and the store root to the record store's native layout checks.
 * @evidence contracts/performance.md#efficient-algorithms Observes supplied roots and candidate ancestry without listing a directory. Only permission refusals advance to a second allocation. The store is consulted only after every system candidate was refused, and an existing store's parent serves without opening it again.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each allocation requires current observations and a unique destination.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The accepted physical directory transfers to the operation for cleanup. Failed postflight can retain an allocation, including when a permission refusal advances to another parent. This helper retains no native handles.
 */
export function createProjectTempDirectory(
  prefix: string,
  projectRoot?: string,
  additionalProjectRoots?: readonly string[],
): string {
  let refusal: unknown;
  const cwd = process.cwd();
  const roots = [
    ...(additionalProjectRoots ?? []),
    ...(projectRoot === undefined ? [] : [cwd]),
  ];
  const allocate = (parent: string): string | undefined => {
    try {
      return createCanonicalTempDirectory(prefix, parent);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code !== "EACCES" && code !== "EPERM" && code !== "EROFS")
        throw error;
      refusal ??= error;
      return undefined;
    }
  };
  for (const { directory } of systemTempOutsideProject.candidates(
    projectRoot ?? path.parse(cwd).root,
    roots,
  )) {
    const allocated = allocate(directory);
    if (allocated !== undefined) return allocated;
  }
  const parent =
    projectRoot === undefined
      ? undefined
      : recordStoreParent(projectRoot, roots);
  if (parent !== undefined) {
    const allocated = allocate(parent);
    if (allocated !== undefined) return allocated;
  }
  throw (
    refusal ??
    new Error(
      projectRoot === undefined
        ? "ttsc: no existing system temporary directory"
        : `ttsc: no existing system temporary directory outside ${projectRoot}`,
    )
  );
}

/**
 * Existing private parents for work that allocates nothing of its own.
 *
 * @evidence contracts/common.md#principled-implementation The parent is the one an allocation for the same roots would use, so a tool started there observes the same private placement policy.
 * @evidence contracts/common.md#clear-and-simple-design Shares the system selector and the record-store fallback with the allocator instead of a second placement rule.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A parent is returned only when the system selector or the record store's ownership checks admit it.
 * @evidence contracts/common.md#meaningful-documentation The member comment states the preference order, the always-included working directory and the failure case.
 * @evidence contracts/portability.md#os-neutral-implementation Delegates native containment, aliases and platform candidates to the system selector, and the store root to the record store's native layout checks.
 * @evidence contracts/performance.md#efficient-algorithms Returns the first qualified system parent without checking later ones. The store is consulted only after every system candidate was refused, and an existing store's parent serves without opening it again.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each caller needs a current placement observation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returns an existing directory and retains nothing.
 */
export namespace createProjectTempDirectory {
  /**
   * Return the parent {@link createProjectTempDirectory} would allocate under,
   * for work that needs an existing private directory rather than a child of
   * its own, such as a neutral working directory for a native tool. The first
   * qualified system temp parent comes first, and the project's record store
   * parent follows when none qualifies. No qualified parent throws.
   *
   * @param projectRoot Project whose boundaries the directory stays outside.
   * @param additionalProjectRoots Other roots the operation reads. The current
   *   working directory always joins them.
   */
  export function parent(
    projectRoot: string,
    additionalProjectRoots: readonly string[] = [],
  ): string {
    const roots = [...additionalProjectRoots, process.cwd()];
    for (const { directory } of systemTempOutsideProject.candidates(
      projectRoot,
      roots,
    ))
      return directory;
    const store = recordStoreParent(projectRoot, roots);
    if (store !== undefined) return store;
    throw new Error(
      `ttsc: no existing system temporary directory outside ${projectRoot}`,
    );
  }
}

/**
 * The project's record store parent that the store's ownership admits. An
 * existing store serves directly, and only a store not opened yet is opened,
 * which creates the parent.
 */
function recordStoreParent(
  projectRoot: string,
  roots: readonly string[],
): string | undefined {
  const owners = [projectRoot, ...roots];
  let root: string;
  try {
    root = resolveSourceBuildCachePaths(projectRoot).root;
  } catch {
    return undefined;
  }
  return (
    selectedRecordIdentityTempParent(root, owners) ??
    selectedRecordIdentityTempParent(
      PluginContentIdentities.open({ projectRoot, env: process.env })?.root,
      owners,
    )
  );
}
