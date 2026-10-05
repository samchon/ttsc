import type { InputCondition } from "./InputCondition";
import type { WatchScope } from "./WatchScope";

/**
 * One compiler-input path an input observer (`createInputObserver`) is
 * responsible for.
 *
 * Holds observed spelling keys (`aliases`), the ancestors whose rename can move
 * it (`renameAliases`), the scopes and links observing it, and the recorded
 * conditions that decide whether an event really changed it. `fallback` marks
 * an entry the bounded poll checks instead of a native scope. These indexes do
 * not enumerate every native event alias; a reporting scope rechecks its
 * covered entries against their recorded conditions.
 *
 * @evidence contracts/common.md#principled-implementation A watched spelling keeps its recorded conditions separate from event aliases, link topology, and scope coverage, so notifications can select an entry before checking what its compile observed.
 * @evidence contracts/common.md#clear-and-simple-design One entry holds shared path observation state while conditions own per-generation evidence and owners; native handles remain with scopes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An event or fallback flag is not itself a successful input proof; conditions must still be checked before notifying owners.
 * @evidence contracts/common.md#meaningful-documentation Member comments distinguish lexical spelling, physical roots, event keys, and fallback reasons with their implementation consequences.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Lexical spelling, observed physical target, link topology and scope coverage
 *   are distinct native boundary data. Alias keys cannot prove every possible
 *   native notification spelling has been enumerated.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   InputEntry only declares a shape; it has no computation at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   InputEntry only declares a shape; it has no work to reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   InputEntry only declares a shape; it has no handle or retained state at
 *   runtime.
 */
export interface InputEntry {
  /**
   * Observed event keys: its own spelling, its physical target, and linked
   * components.
   */
  aliases: Set<string>;

  /** Latest native event already associated with this registered spelling. */
  changedAt: number;

  /** Recorded states by serialized evidence, each with its owners. */
  conditions: Map<string, InputCondition>;

  /**
   * Whether the bounded poll checks this entry: no native scope covers it, the
   * owner declared polling, its directory's case policy could not be measured,
   * it has more than one hard link, a linked component cannot be resolved, or
   * its native watcher failed.
   */
  fallback: boolean;

  /** Absolute spelling registered by the transform. */
  file: string;

  /**
   * The physical spelling of a project root registered for its membership, when
   * the root is named through a link: a backend that reports the physical path
   * of what changed can name the root this way, and the event is placed under
   * the root's own name before its policy is asked (samchon/ttsc#1461).
   */
  physical?: string;

  /** Linked spellings whose retarget can move this entry without an event on it. */
  links: Set<string>;

  /** Ancestor keys whose rename can move this entry. */
  renameAliases: Set<string>;

  /** Native observers covering the entry. */
  scopes: Set<WatchScope>;

  /** Directory-admission keys contributed by this entry to each native scope. */
  scopeDirectories: Map<WatchScope, Set<string>>;
}
