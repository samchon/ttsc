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
 * Snapshot every input outside the project walk that could change a retry, each
 * plugin source directory by its state among them (`pluginSourceState`,
 * samchon/ttsc#1487, samchon/ttsc#1493).
 *
 * Ordinary-path signatures are observed before full state and retained only
 * when the filesystem clock proves separation. Plugin trees carry no single
 * path signature because their source/build environment requires whole-tree
 * validation. The returned map belongs to the terminal comparison baseline.
 * The async generation owner already attempted native environment preparation;
 * unavailable authority records a missing tree state without a cold fallback.
 * Standalone synchronous results retain their original native capture API.
 *
 * @evidence contracts/common.md#principled-implementation External paths, surviving host paths, attributed failures and plugin source roots form the retry environment; metadata-before-state observation prevents a concurrent read from authorizing unchanged-state reuse incorrectly.
 * @evidence contracts/common.md#clear-and-simple-design This capture constructs one baseline map, delegating persistence selection, metadata evidence and ordinary/tree state composition to their owning helpers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Disposed scratch paths are excluded by ownership rather than a blanket dependency filter; missing plugin source state remains a missing marker and tree state is not inferred from parent metadata.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish ordinary signature timing, plugin-tree validation and transferred baseline ownership, with separated tags under documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve normalizes observed spellings and resultFilesystem supplies filesystem capabilities; plugin source state uses the shared native Go/build environment boundary.
 * @evidence contracts/performance.md#efficient-algorithms Set union deduplicates paths before one sorted traversal; each unique tree or exact path is captured once, with state cost driven by file bytes or directory/subtree population.
 * @evidence contracts/performance.md#reuse-equivalent-work Shared envelope selectors and one path union avoid repeated observations of the same spelling; recorded separable signatures permit the later validator's metadata-first state reuse.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This call transfers one map sized by relevant distinct inputs to terminal validation; it retains no observer or scratch directory and the terminal generation owner controls baseline lifetime.
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
            state: pluginSourceState(input, usesPreparedPluginBuildEnvironments(cached.result) ? {
              environment: PluginBuildEnvironmentReadings.cached(input),
            } : undefined) ?? MISSING_INPUT_STATE,
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
