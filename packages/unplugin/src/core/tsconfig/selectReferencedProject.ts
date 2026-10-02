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
 * @returns The selected config, and every other config the search read on the
 *   way to it: the solutions it passed through, each project searched before it
 *   that declined the file, each of their `extends` ancestors, and each
 *   referenced config that does not exist yet. A change to any of them can
 *   re-route the file, whether an earlier project's `include` starts admitting
 *   it or a missing reference appears, so the caller registers them as watch
 *   inputs. When no project admits the file, that is every config searched.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Nearest-project root admission wins, then depth-first declaration-order
 *   references. A visited set cuts cycles; rejected and missing configs remain
 *   consulted inputs because their changes can alter the winning project.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Search owns reference priority while containsRootFile owns include/exclude
 *   interaction and readProjectSelectionEntry owns validated config memoization.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Native config addresses are resolved through Node paths; root admission
 *   delegates to compiler-policy matching, while stat proves nested regular
 *   configs. Neither a shell command nor an OS case guess selects the project.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Solution routing follows actual references instead of naming familiar Vite
 *   configs. No match retains the nearest config rather than inventing membership.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain solution configs and consulted negative choices;
 *   return prose tells callers why those rejected inputs still need watching.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Depth-first search of the references; the visited set stops cycles and
 *   repeats.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The visited set keeps a project already searched from being read again.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The visited and consulted sets are local to the call.
 */
export function selectReferencedProject(
  file: string,
  nearest: string,
): { consulted: string[]; tsconfig: string } {
  const visited = new Set<string>();
  const consulted = new Set<string>();
  const search = (tsconfig: string, nested: boolean): string | undefined => {
    const key = path.resolve(tsconfig);
    if (visited.has(key)) return undefined;
    visited.add(key);
    // A reference that names no readable config selects nothing: its policy
    // would be the permissive fallback, which admits every file. Its content
    // appearing would change that, so it is consulted all the same.
    if (nested && !isFile(key)) {
      consulted.add(key);
      return undefined;
    }
    const entry = readProjectSelectionEntry(key);
    const selectable = !nested || entry.policy.rootFileSpecs !== undefined;
    if (selectable && containsRootFile(file, entry.policy)) return key;
    consulted.add(key);
    for (const source of entry.policy.sources) {
      consulted.add(path.resolve(source));
    }
    if (!selectable) return undefined;
    for (const reference of entry.references) {
      const selected = search(reference, true);
      if (selected !== undefined) return selected;
    }
    return undefined;
  };
  const tsconfig = search(nearest, false) ?? path.resolve(nearest);
  consulted.delete(tsconfig);
  return { consulted: [...consulted], tsconfig };
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
