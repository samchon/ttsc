import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { selectPluginSourceInputs } from "../envelope/selectPluginSourceInputs";
import { inputMetadataEvidence } from "../inputs/inputMetadataEvidence";
import { pluginSourceState } from "../inputs/pluginSourceState";
import { MISSING_INPUT_STATE } from "../validation/MISSING_INPUT_STATE";
import type { TtscFailedGenerationInputState } from "./TtscFailedGenerationInputState";
import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";
import { failedGenerationInputState } from "./failedGenerationInputState";
import { selectPersistentHostInputs } from "./selectPersistentHostInputs";

/**
 * Snapshot every input outside the project walk that could change a retry, each
 * plugin source directory by its state among them (`pluginSourceState`,
 * samchon/ttsc#1487, samchon/ttsc#1493).
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
            state: pluginSourceState(input) ?? MISSING_INPUT_STATE,
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
