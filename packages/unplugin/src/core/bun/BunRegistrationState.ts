import type { TtscUnpluginOptions } from "../options/TtscUnpluginOptions";

/**
 * The single runtime loader's registration and option lifecycle for one Bun
 * runtime, shared by both emitted module conditions of `bun-register`.
 *
 * Options stay pending, replaced last-call-wins, until the loader enters its
 * first included transformable disk load; that entry locks the pending snapshot
 * for this state's runtime session. Host-owned memory files are passed over
 * before locking options.
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
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Pending/locked options can contain a native project spelling; registration
 *   preserves that deferred coordinate and the loader resolves it in its actual
 *   host context. Snapshot identity is not physical config or case-policy proof.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   register owns detached option copying/comparison, ensureRegistered owns
 *   installation and bun setup owns later transform work; this state describes
 *   their transitions without selecting their algorithms.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   registrationState keys shared state by runtime and ensureRegistered guards
 *   accepted/in-flight installation; the fields alone grant no completed-result reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Runtime/provider owners retain this state and detached option graphs;
 *   weak runtime keys alone do not prove their release. No independent state
 *   disposal or snapshot byte bound is specified here.
 */
export interface BunRegistrationState {
  /** Options the next lock takes, detached from the caller's object. */
  activeOptions: TtscUnpluginOptions | undefined;

  /** Options the loader resolved with, once `optionsLocked` holds. */
  lockedOptions: TtscUnpluginOptions | undefined;

  /** Whether a load has started, which fixes `lockedOptions` for good. */
  optionsLocked: boolean;

  /** Installation guard set before the host call and reset on synchronous error. */
  registered: boolean;
}
