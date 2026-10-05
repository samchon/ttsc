import path from "node:path";
import { PluginBuildEnvironmentReadings } from "ttsc/plugin-source";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { selectPluginSourceInputs } from "../envelope/selectPluginSourceInputs";
import { inputMetadataEvidence } from "../inputs/inputMetadataEvidence";
import { pluginSourceState } from "../inputs/pluginSourceState";
import { usesPreparedPluginBuildEnvironments } from "../inputs/preparePluginBuildEnvironments";
import { MISSING_INPUT_STATE } from "../validation/MISSING_INPUT_STATE";
import type { TtscFailedGenerationInputState } from "./TtscFailedGenerationInputState";
import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";
import { failedGenerationInputState } from "./failedGenerationInputState";
import { selectPersistentHostInputs } from "./selectPersistentHostInputs";

/**
 * Snapshot the recorded external paths, persistent host paths, attributed
 * failure paths and plugin source roots for terminal retry comparison
 * (`pluginSourceState`, samchon/ttsc#1487, samchon/ttsc#1493).
 *
 * Ordinary-path signatures are observed before full state and retained only
 * when the filesystem clock proves separation. Plugin trees carry no single
 * path signature because their source/build environment requires whole-tree
 * validation. The returned map belongs to the terminal comparison baseline. The
 * async generation owner already attempted native environment preparation;
 * unavailable authority records a missing tree state without a cold fallback.
 * Standalone synchronous results retain their original native capture API.
 *
 * @evidence contracts/common.md#principled-implementation External paths, surviving host paths, attributed failures and plugin source roots form the retry environment; metadata-before-state observation prevents a concurrent read from authorizing unchanged-state reuse incorrectly.
 * @evidence contracts/common.md#clear-and-simple-design This capture constructs one baseline map, delegating persistence selection, metadata evidence and ordinary/tree state composition to their owning helpers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Host-path selection excludes adapter-owned scratch/wrapper artifacts rather than unrelated dependencies; attributed failure paths are separately retained and do not receive that filter. Missing plugin state stays a missing marker, not a parent-metadata tree proof.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish ordinary signature timing, plugin-tree validation and transferred baseline ownership, with separated tags under documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve normalizes observed spellings and resultFilesystem supplies filesystem capabilities; plugin source state uses the shared native Go/build environment boundary.
 * @evidence contracts/performance.md#efficient-algorithms External/host/failure populations incur native resolve/text/Set work before the unique union is copied and sorted. Host selection and cold plugin selection retain their full scan/identity costs. Each unique tree delegates source/build state work; each ordinary path observes metadata before a fingerprint that may reread metadata, bytes, realpath and directory entries. Cost includes spellings, payload bytes and subtree population; temporary arrays/sets/map records grow with union size.
 * @evidence contracts/performance.md#reuse-equivalent-work Exact spelling union avoids duplicating whole fingerprint capture, while physically equivalent aliases remain distinct observations. Shared envelope/plugin owners retain their validity rules; recorded separable signatures permit later metadata-first comparison but do not reuse current metadata collection or certify an unreadable tree.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One map of distinct recorded inputs and state/signature text transfers to terminal validation; input count and spelling bytes have no cap here. No observer or scratch directory is acquired, and terminal/cache ownership controls baseline lifetime. Native plugin reading retention belongs to its separate environment owner.
 */
export function captureFailedGenerationInputStates(
  cached: TtscCachedProjectTransform,
  failures: TtscGenerationProofFailures,
): ReadonlyMap<string, TtscFailedGenerationInputState> {
  const filesystem = resultFilesystem(cached.result);
  const inputs = new Set(
    (cached.externalInputPaths ?? []).map((input) => path.resolve(input)),
  );
  for (const input of selectPersistentHostInputs({
    filesystem,
    projectRoot: cached.projectRoot,
    result: cached.result,
    scratchDirectory: cached.scratchDirectory,
    temporaryTsconfig: cached.temporaryTsconfig,
  })) {
    inputs.add(path.resolve(input));
  }
  for (const failure of failures.entries) {
    if (failure.path !== undefined) inputs.add(path.resolve(failure.path));
  }
  const trees = selectPluginSourceInputs(cached.result);
  return new Map<string, TtscFailedGenerationInputState>(
    [...new Set([...inputs, ...trees.keys()])].sort().map((input) => {
      if (trees.has(input)) {
        return [
          input,
          {
            state:
              pluginSourceState(
                input,
                usesPreparedPluginBuildEnvironments(cached.result)
                  ? {
                      environment: PluginBuildEnvironmentReadings.cached(input),
                    }
                  : undefined,
              ) ?? MISSING_INPUT_STATE,
            tree: true,
          },
        ];
      }
      // Observed before the state is read, so a write during the read makes
      // the recorded signature disagree with the next observation.
      const evidence = inputMetadataEvidence(input, filesystem);
      return [
        input,
        {
          ...(evidence?.separable === true
            ? { signature: evidence.signature }
            : {}),
          state: failedGenerationInputState(input, filesystem),
        },
      ];
    }),
  );
}
