import type { ITtscProjectMembershipPolicy } from "./ITtscProjectMembershipPolicy";

/**
 * What default-project selection read from each config, memoized by path
 * (samchon/ttsc#1397).
 *
 * Selection runs for every delivered module, so parsing a config and its
 * `extends` chain each time would cost more than the delivery. An entry stays
 * valid while every file it read keeps the `stamp` recorded with it.
 */
export const PROJECT_SELECTION_ENTRIES = new Map<
  string,
  {
    /** The root-file selection the config implies. */
    policy: ITtscProjectMembershipPolicy;
    /** The configs its `references` name, in declaration order. */
    references: readonly string[];
    /** Size and modification time of every file the entry read. */
    stamp: string;
  }
>();
