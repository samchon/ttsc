import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";
import { failedGenerationInputState } from "./failedGenerationInputState";
import { selectPersistentHostInputs } from "./selectPersistentHostInputs";

/** Snapshot every input outside the project walk that could change a retry. */
export function captureFailedGenerationInputStates(
  cached: TtscCachedProjectTransform,
  failures: TtscGenerationProofFailures,
): ReadonlyMap<string, string> {
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
  return new Map(
    [...inputs]
      .sort()
      .map((input) => [input, failedGenerationInputState(input, filesystem)]),
  );
}
