/**
 * The `paths` object found while walking one tsconfig's `extends` chain,
 * together with the directory of the config that declared it (the anchor for
 * relative targets).
 */
export interface IDeclaredPaths {
  /**
   * Directory of the config that declared `paths`, which anchors relative
   * targets.
   */
  baseDir: string;
  /** The raw `compilerOptions.paths` object as declared. */
  paths: Record<string, unknown>;
}
