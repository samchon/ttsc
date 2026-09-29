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
 *
 * @evidence contracts/common.md#principled-implementation Explicit project selection bypasses discovery; implicit selection follows the nearest file candidate and referenced root-file admission, retaining missing nearer candidates whose appearance would change the decision.
 * @evidence contracts/common.md#clear-and-simple-design Three direct branches separate explicit selection, discovered reference selection and no-config fallback; existing helpers own discovery and reference traversal.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing configuration remains a compiler error rather than selecting a fixture-specific project, and passed-over candidates are not dropped from future invalidation evidence.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain relative explicit anchoring, reference selection, the missing-config fallback and why absent nearer candidates are consulted inputs.
 * @evidence contracts/portability.md#os-neutral-implementation Node isAbsolute, dirname and resolution establish native roots and drives; the supplied filesystem governs nearest-candidate checks, and shared compiler root matching owns referenced-project admission.
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
