import type fs from "node:fs";
import type { FilesystemPathIdentityOperations } from "ttsc/path-identity";

/** Cache-owned synchronous filesystem reads used by transform validation. */
export interface TtscTransformFilesystemOperations {
  /** Override the case policy when the observed filesystem is not the host. */
  caseSensitive?: FilesystemPathIdentityOperations["caseSensitive"];
  /** Test whether a validation or resolution candidate currently exists. */
  exists(location: string): boolean;
  /** Read link metadata without following a symbolic link. */
  lstat(location: string): fs.BigIntStats;
  /** Read bytes used by project, graph, and host-input fingerprints. */
  readFile(location: string): Buffer;
  /** Enumerate one project or missing-input proof directory. */
  readdir(location: string): fs.Dirent[];
  /** Resolve one lexical path to its current physical target. */
  realpath(location: string): string;
  /** Read ordinary metadata for file-kind and missing-path checks. */
  stat(location: string): fs.Stats;
  /** Read nanosecond metadata for stable file and directory signatures. */
  statBigInt(location: string): fs.BigIntStats;
  /** Override path parsing when the observed filesystem is not the host. */
  platform?: NodeJS.Platform;
  /**
   * Open one directory's change notification, or throw when the observed
   * filesystem cannot provide one.
   *
   * Left undefined, generations watch the host filesystem: `fs.watch` on POSIX
   * and an isolated broker process on Windows. An embedder observing another
   * filesystem supplies its own; a generation whose watch cannot be opened
   * keeps validating from recorded state instead of losing its cache.
   *
   * Supplying one replaces the Windows broker as well, so an embedder that
   * wraps Node's own `fs.watch` there gives up the isolation that contains the
   * native abort Node's Windows fs-event backend can raise when a watched
   * temporary tree is deleted.
   */
  watch?(
    directory: string,
    listener: (eventType: string, filename: string | null) => void,
    onError: () => void,
    recursive?: boolean,
  ): { close: () => void };
}
