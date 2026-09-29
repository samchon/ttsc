import type { ITtscProjectMembershipPolicy } from "./ITtscProjectMembershipPolicy";

/**
 * What default-project selection read from each config, memoized by path
 * (samchon/ttsc#1397).
 *
 * Selection runs for every delivered module, so parsing a config and its
 * `extends` chain each time would cost more than the delivery. An entry stays
 * valid while its freshly resolved config graph, content and physical spelling
 * keep the stamp recorded with it.
 */
export const PROJECT_SELECTION_ENTRIES = new Map<
  string,
  {
    /** The root-file selection the config implies. */
    policy: ITtscProjectMembershipPolicy;

    /** The configs its `references` name, in declaration order. */
    references: readonly string[];

    /**
     * SHA-256 of the resolved source graph, content and physical spelling, or
     * `undefined` while no read has proven that these held still, so it is read
     * again.
     */
    stamp: string | undefined;
  }
>();
