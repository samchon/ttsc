import path from "node:path";

import { discoverNearestProjectTsconfig } from "../../discovery/discoverNearestProjectTsconfig";
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
 *
 * Every nearer candidate the walk passed over on its way to a config is
 * consulted too, as missing: a `tsconfig.json` appearing beside the file
 * re-routes it to another project, and nothing else it read would change
 * (samchon/ttsc#1543).
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
  const discovery = discoverNearestProjectTsconfig(
    path.dirname(file),
    filesystem,
  );
  const passedOver = discovery.candidates
    .filter((candidate) => !candidate.fileExists)
    .map((candidate) => candidate.file);
  if (discovery.file !== undefined) {
    const selection = selectReferencedProject(file, discovery.file);
    return {
      consulted: [...passedOver, ...selection.consulted],
      tsconfig: selection.tsconfig,
    };
  }
  // With no config at all the walk reached the volume root, and watching
  // every ancestor up to it would watch directories far outside any project.
  return {
    consulted: [],
    tsconfig: path.resolve(process.cwd(), "tsconfig.json"),
  };
}
