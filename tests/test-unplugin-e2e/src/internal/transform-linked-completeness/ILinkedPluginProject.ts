/** One fixture project wired to a set of linked utility plugins. */
export interface ILinkedPluginProject {
  /** Absolute path of the entry module. */
  main: string;
  /** Project root. */
  root: string;
  /** Absolute path of the type-only sibling the entry imports. */
  types: string;
}
