/**
 * The filesystem primitives {@link createCanonicalTempDirectory} uses.
 *
 * Replaceable so a test can model a parent that is retargeted between the
 * preflight and the creation, or a child that escapes its parent, without
 * racing the real filesystem.
 */
export interface CanonicalTempDirectoryOperations {
  /**
   * Link-preserving stat. Used twice: to prove the physical parent is a real
   * directory before creation, and to prove the created child is one too.
   */
  lstat(location: string): { isDirectory(): boolean };

  /** Create a unique directory whose name starts with `prefix`. */
  mkdtemp(prefix: string): string;

  /**
   * Physical path of an existing entry. Must expand every alias (symlinks,
   * junctions, Windows 8.3 names), because the returned spelling is what later
   * writes and recursive cleanup are anchored to.
   */
  realpath(location: string): string;
}
