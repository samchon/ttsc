/**
 * The name every watch bridge's sentinel directory starts with, followed by the
 * owning process id and a random suffix.
 *
 * The process id lets `sweepAbandonedWatchBridges` tell a directory whose owner
 * died without cleaning up from one a live process still signals through. A
 * directory inside a project's `node_modules/.cache`, where the Turbopack
 * loader keeps its sentinels, is otherwise never removed by the system the way
 * the temp directory eventually is.
 */
export const WATCH_BRIDGE_DIRECTORY_PREFIX = "ttsc-watch-bridge-";
