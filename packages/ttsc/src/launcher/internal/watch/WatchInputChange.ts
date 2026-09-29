/**
 * One classified filesystem event from the watch topology, before it is
 * coalesced into a cycle by {@link PendingResidentCheckWatchChanges}.
 *
 * @evidence contracts/common.md#principled-implementation The discriminant distinguishes compiler data, project-rule data and execution-selection inputs; invalidation separately requests a cold Program without replacing the process.
 * @evidence contracts/common.md#clear-and-simple-design One tagged event carries optional localization and an independent resident-invalidation qualification.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The event does not invent a changed path for an unnamed native notification.
 * @evidence contracts/common.md#meaningful-documentation Member paragraphs explain reload categories, invalidation and absent localization following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Optional path preserves the backend's inability to name a changed input instead of assuming every native notification carries a filename.
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
