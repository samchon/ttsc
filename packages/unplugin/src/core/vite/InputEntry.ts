import type { InputCondition } from "./InputCondition";
import type { WatchScope } from "./WatchScope";

/**
 * One compiler-input path the Vite serve watcher is responsible for.
 *
 * Holds every spelling an event can arrive under (`aliases`), the ancestors
 * whose rename can move it (`renameAliases`), the scopes and links observing
 * it, and the recorded conditions that decide whether an event really changed
 * it. `fallback` marks an entry no native scope can cover, which the bounded
 * poll checks instead.
 */
export interface InputEntry {
  /**
   * Event keys this entry answers to: its own spelling, its physical target,
   * and linked components.
   */
  aliases: Set<string>;
  /** Latest native event already associated with this registered spelling. */
  changedAt: number;
  /** Recorded states by serialized evidence, each with its importers. */
  conditions: Map<string, InputCondition>;
  /** Whether no native scope can cover the entry, so the bounded poll checks it. */
  fallback: boolean;
  /** Absolute spelling registered by the transform. */
  file: string;
  /** Linked spellings whose retarget can move this entry without an event on it. */
  links: Set<string>;
  /** Ancestor keys whose rename can move this entry. */
  renameAliases: Set<string>;
  /** Native observers covering the entry. */
  scopes: Set<WatchScope>;
}
