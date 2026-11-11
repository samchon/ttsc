import fs from "node:fs";
import path from "node:path";

import { realPath } from "./realPath";

/**
 * The physical path of a module the runtime is asked to load or scan, resolving
 * each directory once per process.
 *
 * A module that is not itself a link takes its physical path from its
 * directory's, which is resolved the first time a module of that directory is
 * seen. Resolving every module on its own cost one native path resolution per
 * load and per scanned re-export, the largest filesystem cost left in a warm
 * start (samchon/ttsc#1852). The lifetime matches the loader these hooks serve:
 * Node resolves a module once and keeps the answer for the process, so a
 * directory retargeted during a run already belongs to the next one.
 *
 * A link, a missing entry, or any observation failure falls back to
 * {@link realPath}, which resolves that spelling itself.
 *
 * @param file Absolute native path of the module.
 * @evidence contracts/common.md#principled-implementation An entry that lstat reports is not a link has its directory's physical path plus its own name as physical path; links and failures take the per-spelling resolution instead of an inferred one.
 * @evidence contracts/common.md#clear-and-simple-design One helper owns the per-process directory memo; ownership indexes and proofs keep their own fresh resolutions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No case folding or name-based rule stands for resolution; the memo holds only native answers for directories.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state the method, the cost it removes, the lifetime premise and the fallback.
 * @evidence contracts/portability.md#os-neutral-implementation Native lstat identifies links, including Windows junctions, and realpathSync.native expands directory links and short names; the entry's own name keeps its loaded spelling.
 * @evidence contracts/performance.md#efficient-algorithms One metadata request per module and one physical resolution per distinct directory.
 * @evidence contracts/performance.md#reuse-equivalent-work Modules of one directory share its resolution for the process, the lifetime over which the module loader itself keeps a resolved module.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The memo keeps one string pair per directory that held a loaded or scanned module, without eviction, for the process.
 */
export function modulePhysicalPath(file: string): string {
  try {
    if (!fs.lstatSync(file).isSymbolicLink()) {
      const directory = path.dirname(file);
      let physical = directories.get(directory);
      if (physical === undefined) {
        physical = fs.realpathSync.native(directory);
        directories.set(directory, physical);
      }
      return path.join(physical, path.basename(file));
    }
  } catch {
    // The per-spelling resolution below reports or absorbs the failure.
  }
  return realPath(file);
}

/** Physical paths of directories whose modules were loaded or scanned. */
const directories = new Map<string, string>();
