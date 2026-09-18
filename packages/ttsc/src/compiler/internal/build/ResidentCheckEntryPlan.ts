import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";

/**
 * How one configured check-stage plugin entry runs during a watch cycle.
 *
 * Produced by {@link planResidentCheckEntries}. Entries with the same `key`
 * share one resident sidecar; an entry without a key runs as an ordinary
 * one-shot check every cycle.
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
