import {
  PluginBuildEnvironmentReadings,
  processPluginBuildEnvironment,
} from "ttsc/plugin-source";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { pluginSourceHolds } from "../inputs/pluginSourceHolds";
import { usesPreparedPluginBuildEnvironments } from "../inputs/preparePluginBuildEnvironments";
import type { TtscGenerationProof } from "./TtscGenerationProof";
import type { TtscHostInputValidation } from "./TtscHostInputValidation";
import { trackerProvesInputUnchanged } from "./trackerProvesInputUnchanged";

/**
 * Whether every plugin source directory of a generation still holds the state
 * its binary was built from, its files and the environment a build there runs
 * in (samchon/ttsc#1487, samchon/ttsc#1493).
 *
 * A directory whose tracker heard nothing below it has unchanged files, and is
 * skipped while the environment it was last proven under is still this
 * process's prepared reading (`PluginBuildEnvironmentReadings.cached`), which
 * holds only while the Go tool, its environment file, and the C toolchain it
 * names hold: the tracker watches the sources, not the toolchain outside them
 * (samchon/ttsc#1516). Any other is proven by ttsc's rule
 * (`pluginSourceHolds`), since no one path's metadata stands for the files
 * below it. The proof lists the directory as the plugin build lists it, which a
 * delivery pays only after an event below the directory, a changed environment,
 * or where no tracker watches it or its watch cannot vouch for it, and reads
 * the files' bytes again when population, metadata or fresh clock qualification
 * does not permit digest reuse (`pluginSourceFilesDigest`). A missing or stale
 * prepared environment reading returns false here. The async delivery owner
 * prepares that authority before this synchronous proof; that prepared route
 * never starts a cold Go or SDK probe on the host thread. Standalone
 * synchronous results retain their original native observation and mismatch
 * refresh; the async preparation owner marks its result identity.
 *
 * @param cached The generation being validated.
 * @param validation Its universal-input manifest.
 * @evidence contracts/common.md#principled-implementation Source state is qualified together with the Go build environment; tracker silence proves source files only, so changed environment requires the owning plugin-source proof.
 * @evidence contracts/common.md#clear-and-simple-design One validator delegates binary-state semantics to ttsc and records the environment each successful tree proof saw.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A quiet source watcher cannot certify an external toolchain, and unreadable sources cannot become empty successful state.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish source notification, environment authority and metadata-qualified digest reuse before param tags.
 * @evidence contracts/portability.md#os-neutral-implementation Supported plugin-source APIs and capability-qualified native trackers own source/toolchain observation without OS-wide watcher assumptions.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One environment witness per current manifest tree is replaced in place; no delivery history is retained.
 * @evidence contracts/performance.md#efficient-algorithms An exact-generation synchronous transaction supplies one current batched environment qualification; otherwise each tree pays the shared environment reader's variable-key construction and native dependency qualification. Qualified silent sources avoid enumeration; other trees enumerate and sort the selected file population, inspect metadata and hash source bytes whenever population, metadata or clock evidence cannot qualify reuse. The synchronous owner can also refresh native environment authority after a mismatch.
 * @evidence contracts/performance.md#reuse-equivalent-work Generation environment witnesses and the owning digest cache share prior proof only while source and toolchain identities remain valid.
 */
export function matchesUniversalHostInputTrees(
  cached: TtscCachedProjectTransform,
  validation: TtscHostInputValidation,
  proof?: TtscGenerationProof.Transaction,
): boolean {
  for (const [directory, digest] of validation.trees) {
    // Read before any proof, so the environment recorded below is one the
    // proof saw or older, never a newer one it did not prove.
    const prepared = usesPreparedPluginBuildEnvironments(cached.result);
    const environment = prepared
      ? proof?.cached === cached && proof.environments !== undefined
        ? proof.environments.get(directory)
        : PluginBuildEnvironmentReadings.cached(directory)
      : processPluginBuildEnvironment(directory);
    if (environment === undefined) return false;
    if (
      trackerProvesInputUnchanged(cached.hostInputMutationTracker, directory) &&
      validation.treeEnvironments?.get(directory) === environment
    )
      continue;
    if (
      !pluginSourceHolds(
        directory,
        digest,
        resultFilesystem(cached.result),
        prepared ? { environment } : undefined,
      )
    )
      return false;
    (validation.treeEnvironments ??= new Map()).set(directory, environment);
  }
  return true;
}
