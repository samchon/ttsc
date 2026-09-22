/**
 * The name every per-process directory below a host's tool directory starts
 * with, followed by the owning process id and a suffix: the broker's probes,
 * which may not outlive the process. The project records are not among them;
 * they live in one directory for every process (`PROJECT_RECORD_DIRECTORY`).
 *
 * The process id lets `sweepAbandonedWatchBridges` tell a directory whose owner
 * died without cleaning up from one a live process still uses, and it sweeps
 * the per-process directories earlier versions left.
 */
export const WATCH_BRIDGE_DIRECTORY_PREFIX = "ttsc-watch-bridge-";
