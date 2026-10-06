import { createHash } from "node:crypto";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../../../../../packages/unplugin/src/core/transform/cache/resultFilesystem";
import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import { selectExternalInputPaths } from "../../../../../packages/unplugin/src/core/transform/envelope/selectExternalInputPaths";
import { collectProjectInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/project/collectProjectInputSnapshot";
import { captureUniversalHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/captureUniversalHostInputValidation";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";

/**
 * Observe fixture filesystem inputs for a handwritten consumer generation.
 *
 * The caller supplies literal protocol metadata. This helper never invokes or
 * substitutes for a compiler; it only records the real file and directory facts
 * that the delivery decision subsequently compares. Snapshot collection
 * supplies setup data, not the expected action or request-count oracle.
 */
export function observeValidationUnitGeneration(
  root: string,
  result: ITtscCompilerTransformation.ISuccess | ITtscCompilerTransformation.IFailure,
): TtscCachedProjectTransform {
  const tsconfig = path.join(root, "tsconfig.json");
  const cached: TtscCachedProjectTransform = {
    inputHashes: {},
    membershipPolicy: readProjectMembershipPolicy(tsconfig),
    projectRoot: root,
    result,
    tsconfig,
  };
  const filesystem = resultFilesystem(result);
  const state = envelopeDerivation(cached);
  const snapshot = collectProjectInputSnapshot(
    root,
    state.identityContext,
    filesystem,
    undefined,
    { policy: cached.membershipPolicy },
  );
  if (!snapshot.complete)
    throw new Error("Fixture input observation was incomplete");
  cached.projectSnapshotComplete = true;
  cached.projectDirectories = snapshot.projectDirectories;
  cached.inputHashes = snapshot.hashes;
  const external = selectExternalInputPaths({
    filesystem,
    projectRoot: root,
    result,
    membershipPolicy: cached.membershipPolicy,
  });
  cached.externalInputPaths = external;
  cached.externalInputHashes = {};
  cached.externalInputRealpaths = {};
  for (const file of external) {
    const identity = state.identityContext.resolve(file).key;
    const bytes = filesystem.readFile(file);
    cached.externalInputHashes[identity] = createHash("sha256")
      .update(bytes)
      .digest("hex");
    cached.externalInputRealpaths[identity] = filesystem.realpath(file);
  }
  const universal = captureUniversalHostInputValidation(
    cached,
    path.join(root, "src", "mod0.ts"),
  );
  if (universal.validation === undefined) {
    throw new Error(
      "Fixture universal input observation was incomplete: " +
        JSON.stringify(universal.failures),
    );
  }
  cached.hostInputValidation = universal.validation;
  return cached;
}
