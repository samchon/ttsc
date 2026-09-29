import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";

/**
 * How one configured check-stage plugin entry runs during a watch cycle.
 *
 * Produced by {@link planResidentCheckEntries}. Entries with the same `key`
 * share one resident sidecar; an entry without a key runs as an ordinary
 * one-shot check every cycle.
 *
 * @evidence contracts/common.md#principled-implementation Separate entryIndex and optional process key represent configured delivery identity versus capability-dependent sidecar identity.
 * @evidence contracts/common.md#clear-and-simple-design The record carries command selection, configured position and plugin metadata together without owning the scheduler or process.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An absent capability is represented by an absent key, not an invented resident identity or patched plugin metadata.
 * @evidence contracts/common.md#meaningful-documentation Native member comments explain argv, duplicate positions and the undefined key; documented members are separated by blank lines.
 * @evidence contracts/portability.md#os-neutral-implementation The record preserves native executable selection separately from argv and environment-carried compiler flags; consumers own native spawning and filesystem identity.
 */
export type ResidentCheckEntryPlan = {
  /** Full argv of the entry's check command (or of its `check-serve` host). */
  args: string[];

  /**
   * Position of the entry among the configured check-stage plugins. Two entries
   * that share a resident process are still reported in configuration order,
   * and pending watch changes are buffered per entry by this index.
   */
  entryIndex: number;

  /**
   * Resident process identity: binary, plugin name, argv, and the forwarded
   * compiler flags. `undefined` when the plugin does not declare the
   * `residentCheck` capability.
   */
  key: string | undefined;

  /** The configured plugin this entry runs. */
  plugin: ITtscLoadedNativePlugin;
};
