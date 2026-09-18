/**
 * One classified filesystem event from the watch topology, before it is
 * coalesced into a cycle by {@link PendingResidentCheckWatchChanges}.
 */
export type WatchInputChange = {
  /** Keep the resident process but cold-load its compiler Program. */
  invalidate?: boolean;

  /**
   * Which population the path belongs to. `config` and `plugin` changes force a
   * full reload; `compiler` is a TypeScript input; `project` is a file a
   * project rule declared as its own input.
   */
  kind: "compiler" | "config" | "plugin" | "project";

  /**
   * The changed path, when the backend named it. An unnamed `compiler` event
   * cannot be localized and is treated as a reload.
   */
  path?: string;
};
