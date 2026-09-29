import type { InputCondition } from "./InputCondition";
import type { WatchScope } from "./WatchScope";

/**
 * One compiler-input path an input observer (`createInputObserver`) is
 * responsible for.
 *
 * Holds every spelling an event can arrive under (`aliases`), the ancestors
 * whose rename can move it (`renameAliases`), the scopes and links observing
 * it, and the recorded conditions that decide whether an event really changed
 * it. `fallback` marks an entry the bounded poll checks instead of a native
 * scope.
 *
 * @evidence contracts/common.md#principled-implementation A watched spelling keeps its recorded conditions separate from event aliases, link topology, and scope coverage, so notifications can select an entry before checking what its compile observed.
 * @evidence contracts/common.md#clear-and-simple-design One entry holds shared path observation state while conditions own per-generation evidence and owners; native handles remain with scopes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An event or fallback flag is not itself a successful input proof; conditions must still be checked before notifying owners.
 * @evidence contracts/common.md#meaningful-documentation Member comments distinguish lexical spelling, physical roots, event keys, and fallback reasons with their implementation consequences.
 */
export interface InputEntry {
  /**
   * Event keys this entry answers to: its own spelling, its physical target,
   * and linked components.
   */
  aliases: Set<string>;

  /** Latest native event already associated with this registered spelling. */
  changedAt: number;

  /** Recorded states by serialized evidence, each with its owners. */
  conditions: Map<string, InputCondition>;

  /**
   * Whether the bounded poll checks this entry: no native scope covers it, it
   * has more than one hard link, a linked component cannot be resolved, or its
   * native watcher failed.
   */
  fallback: boolean;

  /** Absolute spelling registered by the transform. */
  file: string;

  /**
   * The physical spelling of a project root registered for its membership, when
   * the root is named through a link: a backend that reports the physical path
   * of what changed, FSEvents on every macOS temporary directory, names the
   * root this way, and the event is placed under the root's own name before its
   * policy is asked (samchon/ttsc#1461).
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
