/** One contributor's resolved Go source plus its target sub-package name. */
export interface ITtscBuildContributor {
  /** Sub-package suffix: scratch lands at `<host>/contrib/<name>/`. */
  name: string;
  /** Absolute path to the contributor's source directory. */
  source: string;
}
