import path from "node:path";

import { insideExcludedProjectDirectory } from "../transform/project/insideExcludedProjectDirectory";
import type { ITtscProjectMembershipPolicy } from "./ITtscProjectMembershipPolicy";
import { isFile } from "./isFile";
import { matchesProjectRootFile } from "./matchesProjectRootFile";
import { readProjectSelectionEntry } from "./readProjectSelectionEntry";

/**
 * Select the project that compiles `file`, starting from its nearest config and
 * following `references` the way TypeScript's project service does
 * (samchon/ttsc#1397).
 *
 * A solution config such as create-vite's `react-ts` template declares
 * `"files": []` and lists its real projects under `references`, so compiling
 * the nearest config produced an empty program and left every module
 * untransformed. The nearest config is kept when its own program contains the
 * file as a root. Otherwise each reference is searched depth-first in
 * declaration order, cycle-safe, and the first project that admits the file is
 * selected. When none does, the nearest config is kept and the module is left
 * to the host as before.
 *
 * @returns The selected config, and the configs whose content decided the
 *   selection besides it. A change to one of those can re-route the file, so
 *   the caller registers them as watch inputs.
 */
export function selectReferencedProject(
  file: string,
  nearest: string,
): { consulted: string[]; tsconfig: string } {
  const visited = new Set<string>();
  const search = (
    tsconfig: string,
    trail: readonly string[],
  ): { consulted: string[]; tsconfig: string } | undefined => {
    const key = path.resolve(tsconfig);
    if (visited.has(key)) return undefined;
    visited.add(key);
    // A reference that names no readable config selects nothing: its policy
    // would be the permissive fallback, which admits every file.
    if (trail.length !== 0 && !isFile(key)) return undefined;
    const entry = readProjectSelectionEntry(key);
    if (trail.length !== 0 && entry.policy.rootFileSpecs === undefined) {
      return undefined;
    }
    if (containsRootFile(file, entry.policy)) {
      return { consulted: [...trail], tsconfig: key };
    }
    for (const reference of entry.references) {
      const selected = search(reference, [...trail, key]);
      if (selected !== undefined) return selected;
    }
    return undefined;
  };
  const selected = search(nearest, []);
  if (selected !== undefined) return selected;
  return { consulted: [], tsconfig: path.resolve(nearest) };
}

/**
 * Whether a project's program takes `file` as a root file.
 *
 * TypeScript applies `exclude` to what `include` matched and takes each `files`
 * entry as it is, so a project whose `include` reaches a directory it also
 * excludes does not contain the files below it unless it lists them.
 */
function containsRootFile(
  file: string,
  policy: ITtscProjectMembershipPolicy,
): boolean {
  if (!matchesProjectRootFile(file, policy, false)) return false;
  if (!insideExcludedProjectDirectory(file, policy, false)) return true;
  const specs = policy.rootFileSpecs;
  return (
    specs !== undefined &&
    specs.files.length !== 0 &&
    matchesProjectRootFile(
      file,
      { ...policy, rootFileSpecs: { ...specs, include: [] } },
      false,
    )
  );
}
