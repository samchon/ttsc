import fs from "node:fs";

/**
 * The filesystem primitives a {@link FilesystemPathIdentityContext} consults.
 *
 * Every member is replaceable so a test can pin one platform's semantics on
 * another host (a case-sensitive directory on Windows, an 8.3 alias on POSIX)
 * without touching the real disk. Production callers pass a partial object, or
 * none, and inherit the host's own behavior for the rest.
 */
export type FilesystemPathIdentityOperations = {
  /**
   * Whether names inside `directory` are compared case-sensitively. Asked only
   * about an existing directory, and only when a missing suffix below it has to
   * be either folded or kept.
   */
  caseSensitive(directory: string): boolean;

  /**
   * Link-preserving stat the default case-sensitivity probe uses to test
   * whether a name opens under its alternate case. Defaults to `fs.lstatSync`.
   */
  lstat?(location: string): fs.Stats | fs.BigIntStats;

  /**
   * Path semantics to apply. `win32` selects backslash separators, drive and
   * UNC roots, and a case-folded volume key; anything else is POSIX.
   */
  platform: NodeJS.Platform;

  /**
   * Directory listing the default case-sensitivity probe reads. Defaults to
   * `fs.readdirSync`.
   */
  readdir?(directory: string): string[];

  /**
   * Physical path of an existing entry. Defaults to `fs.realpathSync.native`,
   * which, unlike the JavaScript implementation, also expands Windows 8.3 short
   * names.
   */
  realpath(location: string): string;

  /**
   * When `true` (the default), a realpath failure other than a missing entry
   * propagates. When `false`, every failure reads as "does not exist yet" and
   * resolution continues with the parent, which is what a best-effort caller
   * such as the runtime hooks needs.
   */
  throwOnRealpathError: boolean;
};
