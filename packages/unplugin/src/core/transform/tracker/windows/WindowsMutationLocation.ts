/**
 * One directory the Windows broker watches for a tracker.
 *
 * A location either watches the named entries of one directory (`names`) or,
 * with `recursive`, the whole tree below it. The name form is how exact-input
 * trackers keep their event traffic proportional to the inputs they own.
 */
export interface WindowsMutationLocation {
  directory: string;
  names?: string[];
  recursive?: boolean;
}
