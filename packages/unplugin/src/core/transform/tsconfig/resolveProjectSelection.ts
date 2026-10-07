import path from "node:path";

import { discoverNearestProjectTsconfig } from "../../discovery/discoverNearestProjectTsconfig";
import { selectReferencedProject } from "../../tsconfig/selectReferencedProject";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * Select the transform tsconfig and consulted routing spellings for `file`.
 *
 * An explicit `tsconfig` is returned as-is (absolute) or resolved from
 * `process.cwd()` (relative), and decides alone. Otherwise the nearest ancestor
 * `tsconfig.json` proven to be a file is the starting point, and a solution
 * config's `references` are followed to the project whose root-file selection
 * admits the file (samchon/ttsc#1397). With no ancestor config the answer is
 * `<cwd>/tsconfig.json`; the compiler will error if that file does not exist,
 * which is the correct behavior for a mis-configured project.
 *
 * When discovery finds a config, nearer candidates not observed as files are
 * retained too. That can mean absence, another kind or unavailable metadata: a
 * `tsconfig.json` appearing beside the file re-routes it to another project,
 * and nothing else it read would change (samchon/ttsc#1543). With no discovered
 * config, the cwd fallback returns no consulted ancestor spellings, avoiding
 * registration of machine-wide ancestors. This result does not provide
 * observation proof or a watch for every failed discovery candidate.
 *
 * @evidence contracts/common.md#principled-implementation Explicit selection bypasses discovery. A discovered config follows referenced root-file admission and retains passed-over nonfile candidates; the no-config cwd fallback deliberately returns no consulted ancestors rather than certifying those unknown or absent paths unchanged.
 * @evidence contracts/common.md#clear-and-simple-design Three direct branches separate explicit selection, discovered reference selection and no-config fallback; existing helpers own discovery and reference traversal.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fallback address is the caller's cwd config, not a fixture-specific project or successful existence proof. Discovered-route passed-over spellings remain explicit; downstream consumers must distinguish spellings from actual selection observations.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain relative explicit anchoring, reference selection, the missing-config fallback and why absent nearer candidates are consulted inputs.
 * @evidence contracts/portability.md#os-neutral-implementation Node isAbsolute/dirname/resolution establish native anchors. Supplied discovery operations control its candidate dialect/checks, while referenced selection uses the native config readers and compiler policy; those views must agree, and injection does not replace all downstream native reads.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Explicit selection does path text work only. Implicit discovery visits D
 *   ancestors/native stat candidates and filters/copies their references;
 *   referenced selection adds reachable-config/source-byte/spec matching work,
 *   despite this wrapper delegating its graph traversal.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Discovery is a current routing question and this operation stores no
 *   cross-request selection. Referenced config-entry caching and generation
 *   reuse qualification remain with their own observed-input owners.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
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
