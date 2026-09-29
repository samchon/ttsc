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
import { onlyLearnedCompileFacts } from "./onlyLearnedCompileFacts";

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
 * of twice the bound still ends a project whose dependencies never settle. The
 * compiler's case policy is learned the same way: a walk primed with another
 * policy is taken again under the one the compile reported
 * (samchon/ttsc#1545).
 *
 * @evidence contracts/common.md#principled-implementation Each capture must establish config coherence plus reusable success proof or a still-current diagnostic verdict; learned compile facts and refuted publications have distinct retry premises, while movement and absolute attempt caps ensure termination.
 * @evidence contracts/common.md#clear-and-simple-design The loop owns attempt classification and resource handoff, while capture owns proof construction and the shared error builder owns terminal rendering and final disposal.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Retrying follows actual newly learned dependencies/case policy or refuted publication state rather than an endless workaround chain; failed proof never becomes a reusable success through reaching the attempt bound.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain movement versus absolute budgets, failed-compile diagnostics and learned facts; separated props state delivery, tracking and inherited witness meaning.
 * @evidence contracts/portability.md#os-neutral-implementation Each capture delegates native filesystem and compiler behavior to injected host boundaries; reported compiler case policy is carried between attempts rather than guessed from OS names.
 * @evidence contracts/performance.md#efficient-algorithms At most twice the two-movement bound captures occur, reusing witnessed dependency paths and learned case policy; a successful or current diagnostic capture returns immediately.
 * @evidence contracts/performance.md#reuse-equivalent-work The attempt carries learned input witnesses and policy forward, and session publication classification permits equivalent proven compiles to be adopted instead of redundantly compiling each worker's state.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Every nonterminal rejected capture is disposed before retry, terminal error creation disposes the final failed capture and successful/diagnostic return transfers its resources to the cache owner; at most four attempt witness sets remain local.
 */
export async function transformProject(props: {
  /** Adapter aliases re-stated over inherited project paths for compilation. */
  aliasPaths: Record<string, string[]>;

  /** Compiler-option overlay, preserving the underlying config semantics. */
  compilerOptions: Record<string, unknown>;

  /** Native path of the module whose delivery initiated this capture. */
  currentFile: string;

  /** Delivered module text compared against the compiler's disk observation. */
  currentSource: string;

  /**
   * Delivery pass this compile was started for; see
   * {@link TtscCachedProjectTransform.deliveryEpoch}.
   */
  deliveryEpoch?: number;

  /** Host filesystem boundary for project and external-input proof. */
  filesystem: TtscTransformFilesystemOperations;

  /** Native plugin descriptors supplied to the compiler. */
  plugins?: ResolvedTtscUnpluginOptions["plugins"];

  /** Whether live membership observers may transfer to a retained generation. */
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

  /** Whether a pre-compile membership tracker should witness the capture window. */
  trackProjectMembership: boolean;

  /** Native project config selected for the whole-project transform. */
  tsconfig: string;

  /**
   * Dependency-only paths the last generation of this cache key reported
   * (`TRANSFORM_CACHE_DEPENDENCY_WITNESSES`), to be witnessed before the
   * compile; see {@link TtscCachedProjectTransform.externalDependencyInputs}.
   */
  witnessedDependencies?: readonly string[];

  /**
   * The case policy the last generation of this cache key reported
   * (`TRANSFORM_CACHE_CASE_POLICIES`, samchon/ttsc#1545).
   */
  useCaseSensitiveFileNames?: boolean;
}): Promise<TtscCachedProjectTransform> {
  const attempts: TtscGenerationProofFailures[] = [];
  let rejected: string | undefined;
  let moved = 0;
  const witnessed = new Set(props.witnessedDependencies);
  let useCaseSensitiveFileNames = props.useCaseSensitiveFileNames;
  for (let attempt = 0; ; attempt += 1) {
    const cached = await captureTransformGeneration({
      ...props,
      rejected,
      useCaseSensitiveFileNames,
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
    useCaseSensitiveFileNames =
      cached.membershipPolicy.useCaseSensitiveFileNames ??
      useCaseSensitiveFileNames;
    // A publication refuted here would be found again by a retry for the same
    // state, which therefore compiles and replaces it. A retry whose project
    // moved to another state claims that state's publication, and adopts it:
    // refusing it too, measured on a Turbopack pool, compiled a state another
    // worker had just published, while the next edit was already landing. An
    // adoption whose own window moved refutes nothing, and is counted as the
    // compile it stood in for.
    const adopted = TRANSFORM_ADOPTED_RESULTS.get(cached.result);
    if (adopted?.refuted === true) rejected = adopted.state;
    else if (!onlyLearnedCompileFacts(failures)) moved += 1;
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
