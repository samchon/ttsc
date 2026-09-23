/**
 * The name the broker's probe directory starts with, followed by the owning
 * process id (samchon/ttsc#1453).
 *
 * The broker proves a macOS stream delivered by writing a probe into a
 * directory of its process's own, below the probed project's tool cache
 * (`node_modules/.cache/ttsc`), which may not outlive that process. The process
 * id lets `sweepAbandonedWatchProbes` tell a directory whose owner died without
 * removing it from one a live process still writes to.
 */
export const WATCH_PROBE_DIRECTORY_PREFIX = "ttsc-watch-probes-";
