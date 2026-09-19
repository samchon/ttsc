import type { LinuxWatchHelper } from "./LinuxWatchHelper";

/**
 * The process's Linux watch helper, and the binaries that failed to serve as
 * one (samchon/ttsc#1426).
 *
 * A binary that exits before answering anything, such as one built before the
 * helper existed, is not started again: every watch would fail the same way,
 * one process launch at a time.
 */
export const LINUX_WATCH_HELPER: {
  current?: LinuxWatchHelper;
  refused: Set<string>;
} = { refused: new Set() };
