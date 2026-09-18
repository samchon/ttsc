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
  aliases: Set<string>;
  /** Latest native event already associated with this registered spelling. */
  changedAt: number;
  conditions: Map<string, InputCondition>;
  fallback: boolean;
  file: string;
  links: Set<string>;
  renameAliases: Set<string>;
  scopes: Set<WatchScope>;
}
