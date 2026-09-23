import path from "node:path";

import type { ResolvedTtscUnpluginOptions } from "../../options/ResolvedTtscUnpluginOptions";
import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { disposeCachedTransform } from "../cache/disposeCachedTransform";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { TRANSFORM_ADOPTED_RESULTS } from "../session/TRANSFORM_ADOPTED_RESULTS";
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
 * compile.
 *
 * A failed compile (a `failure` or `exception` envelope) needs no proven
 * snapshot, since its verdict is its diagnostics, but it does need the project
 * to have held still across it. One that read a source repaired while it ran
 * reports a state already gone, and a host that takes its dependencies when the
 * transform returns, as Turbopack does, records the repair as the baseline and
 * never re-runs the module. It is compiled again, and when the project moves
 * under the retry too, the retry's own failure is returned.
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
  /**
   * The pooled host session's shared compile store, when the cache shares its
   * compiles (samchon/ttsc#1390).
   */
  session?: string;
  trackProjectMembership: boolean;
  tsconfig: string;
}): Promise<TtscCachedProjectTransform> {
  const attempts: TtscGenerationProofFailures[] = [];
  let rejected: string | undefined;
  for (let attempt = 0; attempt < TRANSFORM_GENERATION_ATTEMPTS; attempt += 1) {
    const cached = await captureTransformGeneration({ ...props, rejected });
    if (
      cached.configStateComplete !== false &&
      (cached.result.type === "success"
        ? cached.projectSnapshotComplete === true
        : cached.projectHeldStill !== false)
    ) {
      return cached;
    }
    attempts.push(
      TRANSFORM_GENERATION_FAILURES.get(cached.result) ??
        createGenerationProofFailures(),
    );
    // Another worker's compile that failed its proof here would be found again
    // by a retry for the same state, which therefore compiles and replaces the
    // publication. A retry whose project moved to another state claims that
    // state's publication, and adopts it: refusing it too, measured on a
    // Turbopack pool, compiled a state another worker had just published,
    // while the next edit was already landing.
    rejected = TRANSFORM_ADOPTED_RESULTS.get(cached.result) ?? rejected;
    // A failed compile the project moved under twice still names its own
    // diagnostics, which say more than an unstable-generation error.
    if (
      attempt + 1 === TRANSFORM_GENERATION_ATTEMPTS &&
      cached.result.type !== "success" &&
      cached.configStateComplete !== false
    ) {
      return cached;
    }
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
