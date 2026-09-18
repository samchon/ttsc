import path from "node:path";

import type { ResolvedTtscUnpluginOptions } from "../../options/ResolvedTtscUnpluginOptions";
import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { disposeCachedTransform } from "../cache/disposeCachedTransform";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { TRANSFORM_FAILED_GENERATION_VALIDATIONS } from "./TRANSFORM_FAILED_GENERATION_VALIDATIONS";
import { TRANSFORM_GENERATION_FAILURES } from "./TRANSFORM_GENERATION_FAILURES";
import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";
import { captureTransformGeneration } from "./captureTransformGeneration";
import { createGenerationProofFailures } from "./createGenerationProofFailures";
import { createUnstableGenerationError } from "./createUnstableGenerationError";

/** One retry absorbs a transient watch write without admitting an infinite loop. */
const TRANSFORM_GENERATION_ATTEMPTS = 2;

/**
 * Compile one whole project generation, retrying once if its proof was lost to
 * a filesystem race.
 *
 * A capture whose snapshot could not be proven stable is disposed and attempted
 * again. A second failure becomes a terminal `TtscUnstableGenerationError` that
 * carries the failed environment, so later deliveries replay the verdict until
 * that environment provably changes instead of each repeating a whole-project
 * compile. A failed compile (a `failure` or `exception` envelope) is returned
 * as is once its config state stayed coherent, because its proof is about its
 * diagnostics, not about a stable snapshot; a config that moved during the
 * compile is retried like any other lost race.
 */
export async function transformProject(props: {
  aliasPaths: Record<string, string[]>;
  compilerOptions: Record<string, unknown>;
  currentFile: string;
  currentSource: string;
  /**
   * Delivery pass this compile was started for; see
   * {@link TtscCachedProjectTransform.deliveryEpoch}.
   */
  deliveryEpoch?: number;
  filesystem: TtscTransformFilesystemOperations;
  plugins?: ResolvedTtscUnpluginOptions["plugins"];
  retainProjectMembership: boolean;
  /**
   * Whether the generation may keep watchers whose silence stands in for
   * re-reading its inputs. False once the host or the environment declares
   * polling (samchon/ttsc#1395); the generation then validates every delivery
   * against its recorded state.
   */
  retainNotifications: boolean;
  trackProjectMembership: boolean;
  tsconfig: string;
}): Promise<TtscCachedProjectTransform> {
  const attempts: TtscGenerationProofFailures[] = [];
  for (let attempt = 0; attempt < TRANSFORM_GENERATION_ATTEMPTS; attempt += 1) {
    const cached = await captureTransformGeneration(props);
    if (
      cached.configStateComplete !== false &&
      (cached.result.type !== "success" ||
        cached.projectSnapshotComplete === true)
    ) {
      return cached;
    }
    attempts.push(
      TRANSFORM_GENERATION_FAILURES.get(cached.result) ??
        createGenerationProofFailures(),
    );
    if (attempt + 1 === TRANSFORM_GENERATION_ATTEMPTS) {
      const validation = TRANSFORM_FAILED_GENERATION_VALIDATIONS.get(
        cached.result,
      );
      if (validation === undefined) {
        disposeCachedTransform(cached);
        throw new Error(
          "ttsc: failed transform generation has no retry validation baseline",
        );
      }
      throw createUnstableGenerationError(
        path.dirname(props.tsconfig),
        attempts,
        validation,
      );
    }
    disposeCachedTransform(cached);
  }
  throw new Error("ttsc: transform generation retry loop did not terminate");
}
