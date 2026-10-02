import type { TtscUnpluginOptions } from "../options/TtscUnpluginOptions";

/**
 * The single runtime loader's registration and option lifecycle for one Bun
 * runtime, shared by both emitted module conditions of `bun-register`.
 *
 * Options stay pending, replaced last-call-wins, until the loader enters its
 * first transformable load; that entry locks the pending snapshot for the rest
 * of the process.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Pending and locked snapshots distinguish pre-load replacement from the
 *   immutable module-loading session; registered separately tracks installation.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One state record coordinates both emitted module conditions and keeps the
 *   registration and option-lock transitions visible to their owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The lock models Bun's first-matching-loader behavior; it does not disguise
 *   a second registration as reconfiguration of an already-started session.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain last-call-wins and the first-load lock. Spaced
 *   member comments identify snapshot ownership per documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   BunRegistrationState only declares a shape; it has no filesystem, path or
 *   process operation at runtime.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   BunRegistrationState only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   BunRegistrationState only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   BunRegistrationState only declares a shape; it has no handle or retained
 *   state at runtime.
 */
export interface BunRegistrationState {
  /** Options the next lock takes, detached from the caller's object. */
  activeOptions: TtscUnpluginOptions | undefined;

  /** Options the loader resolved with, once `optionsLocked` holds. */
  lockedOptions: TtscUnpluginOptions | undefined;

  /** Whether a load has started, which fixes `lockedOptions` for good. */
  optionsLocked: boolean;

  /** Whether the runtime already holds this state's one loader. */
  registered: boolean;
}
