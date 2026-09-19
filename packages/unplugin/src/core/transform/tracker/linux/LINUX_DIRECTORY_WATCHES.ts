import type { LinuxDirectoryWatch } from "./LinuxDirectoryWatch";

/**
 * Every directory watch the process holds on a platform without native
 * recursive notification, keyed by absolute directory.
 *
 * One helper watch per directory is shared by every observer that needs it: the
 * project and input trackers of each retained generation and the Vite serve
 * scopes, so a capture never opens a duplicate watch and the process's inotify
 * use is bounded by the distinct directories its proofs need
 * (samchon/ttsc#1389). The watches live in the Linux watch helper
 * (samchon/ttsc#1426).
 */
export const LINUX_DIRECTORY_WATCHES = new Map<string, LinuxDirectoryWatch>();
