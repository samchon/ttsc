/**
 * The `paths` object found while walking one tsconfig's `extends` chain,
 * together with the directory of the config that declared it (the anchor for
 * relative targets).
 */
export interface IDeclaredPaths {
  baseDir: string;
  paths: Record<string, unknown>;
}
