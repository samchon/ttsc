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
import { onlyUnwitnessedDependencies } from "./onlyUnwitnessedDependencies";

/** One retry absorbs a transient watch write without admitting an infinite loop. */
const TRANSFORM_GENERATION_ATTEMPTS = 2;

/**
 * Compile one whole project generation, retrying within a bound while its proof
 * is lost to a filesystem race.
 *
 * A capture whose snapshot could not be proven stable is disposed and attempted
 * again. The second failure that says the project moved becomes a terminal
 * `TtscUnstableGenerationError` that carries the failed environment, so later
 * deliveries replay the verdict until that environment provably changes instead
 * of each repeating a whole-project compile.
 *
 * The bound is for a project that keeps moving, so it counts the failures that
 * say the project moved: every compile here that fails its proof, and every
 * adoption whose own window moved. An attempt that adopted another worker's
 * compile and could not prove it failed for one of two reasons
 * (`TtscAdoptionVerdict`, samchon/ttsc#1479). When the publication itself
 * failed its proof on this disk, the attempt says nothing about the project
 * moving: the attempt after it refuses that publication and compiles the same
 * state here, or claims the state the project moved to, and it does not spend
 * the bound, which a pool would otherwise exhaust on publications while its
 * project moved once, and end the delivery in an unstable verdict that
 * compiling the state resolves. When the publication held and only this
 * worker's window moved around it, the attempt is a moved window like any
 * compile's here, and spends the bound; its retry claims whatever state it then
 * reads, and adopts the same publication again when the project's content never
 * changed. Refusing it, as every failed adoption once was, compiled on a
 * Turbopack pool a state the pool had already compiled and proven, for an event
 * that changed nothing. The attempts are capped at twice the bound all the
 * same, so a project that keeps moving from one published state to the next
 * ends too.
 *
 * A failed compile (a `failure` or `exception` envelope) needs no proven
 * snapshot, since its verdict is its diagnostics, but it does need the project
 * to have held still across it. One that read a source repaired while it ran
 * reports a state already gone, and a host that takes its dependencies when the
 * transform returns, as Turbopack does, records the repair as the baseline and
 * never re-runs the module. It is compiled again, and when the project moves
 * under the retry too, the retry's own failure is returned.
 *
 * A plugin-reported dependency path is certified only against a witness read
 * before the compile (samchon/ttsc#1541), and a compile learns such paths only
 * from its own envelope. An attempt whose one failure is a dependency path it
 * reported for the first time is retried with that path witnessed. It says
 * nothing about the project moving, so it does not spend the bound, and the cap
 * of twice the bound still ends a project whose dependencies never settle.
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
  /**
   * Dependency-only paths the last generation of this cache key reported
   * (`TRANSFORM_CACHE_DEPENDENCY_WITNESSES`), to be witnessed before the
   * compile; see {@link TtscCachedProjectTransform.externalDependencyInputs}.
   */
  witnessedDependencies?: readonly string[];
}): Promise<TtscCachedProjectTransform> {
  const attempts: TtscGenerationProofFailures[] = [];
  let rejected: string | undefined;
  let moved = 0;
  const witnessed = new Set(props.witnessedDependencies);
  for (let attempt = 0; ; attempt += 1) {
    const cached = await captureTransformGeneration({
      ...props,
      rejected,
      witnessedDependencies: [...witnessed],
    });
    if (
      cached.configStateComplete !== false &&
      (cached.result.type === "success"
        ? cached.projectSnapshotComplete === true
        : cached.projectHeldStill !== false)
    ) {
      return cached;
    }
    const failures =
      TRANSFORM_GENERATION_FAILURES.get(cached.result) ??
      createGenerationProofFailures();
    attempts.push(failures);
    for (const dependency of cached.externalDependencyInputs ?? []) {
      witnessed.add(dependency);
    }
    // A publication refuted here would be found again by a retry for the same
    // state, which therefore compiles and replaces it. A retry whose project
    // moved to another state claims that state's publication, and adopts it:
    // refusing it too, measured on a Turbopack pool, compiled a state another
    // worker had just published, while the next edit was already landing. An
    // adoption whose own window moved refutes nothing, and is counted as the
    // compile it stood in for.
    const adopted = TRANSFORM_ADOPTED_RESULTS.get(cached.result);
    if (adopted?.refuted === true) rejected = adopted.state;
    else if (!onlyUnwitnessedDependencies(failures)) moved += 1;
    const last =
      moved === TRANSFORM_GENERATION_ATTEMPTS ||
      attempt + 1 === TRANSFORM_GENERATION_ATTEMPTS * 2;
    // A failed compile the project moved under twice still names its own
    // diagnostics, which say more than an unstable-generation error.
    if (
      last &&
      cached.result.type !== "success" &&
      cached.configStateComplete !== false
    ) {
      return cached;
    }
    if (last) {
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
}
