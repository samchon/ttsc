import path from "node:path";

import { findNearestProjectTsconfig } from "../../discovery/findNearestProjectTsconfig";
import { selectReferencedProject } from "../../tsconfig/selectReferencedProject";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * Select the tsconfig that governs the transform for `file`, with the configs
 * whose content decided that selection.
 *
 * An explicit `tsconfig` is returned as-is (absolute) or resolved from
 * `process.cwd()` (relative), and decides alone. Otherwise the nearest ancestor
 * `tsconfig.json` proven to be a file is the starting point, and a solution
 * config's `references` are followed to the project whose root-file selection
 * admits the file (samchon/ttsc#1397). With no ancestor config the answer is
 * `<cwd>/tsconfig.json`; the compiler will error if that file does not exist,
 * which is the correct behavior for a mis-configured project.
 */
export function resolveProjectSelection(
  file: string,
  tsconfig?: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): { consulted: string[]; tsconfig: string } {
  if (tsconfig !== undefined) {
    return {
      consulted: [],
      tsconfig: path.isAbsolute(tsconfig)
        ? tsconfig
        : path.resolve(process.cwd(), tsconfig),
    };
  }
  const discovered = findNearestProjectTsconfig(path.dirname(file), filesystem);
  if (discovered !== undefined) {
    return selectReferencedProject(file, discovered);
  }
  return {
    consulted: [],
    tsconfig: path.resolve(process.cwd(), "tsconfig.json"),
  };
}
