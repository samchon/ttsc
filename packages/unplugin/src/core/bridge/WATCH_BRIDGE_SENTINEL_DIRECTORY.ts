/**
 * The directory below a host's tool directory that holds the watch bridge's
 * sentinels, one file per importer, shared by every process and session on the
 * project (`openHostWatchBridge`).
 *
 * It is not named after a process: a sentinel is a dependency a host's
 * persistent cache records for the module it signals, and one that outlives the
 * session is what lets the next session restore that module from the cache
 * (samchon/ttsc#1468). The per-process directories beside it
 * (`WATCH_BRIDGE_DIRECTORY_PREFIX`) hold what must not outlive a process: the
 * Turbopack marker for modules with untracked inputs, and the broker's probes.
 */
export const WATCH_BRIDGE_SENTINEL_DIRECTORY = "watch-bridge";
