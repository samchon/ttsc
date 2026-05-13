/**
 * One contributor entry inside `ITtscPlugin.contributors`.
 *
 * The native builder copies `source` into `<scratch>/contrib/<name>/` and adds
 * a blank-import for `<host-module>/contrib/<name>` to the synthesized
 * `ttsc_contributions.go` placed alongside the host's main package.
 */
export interface ITtscPluginContributor {
  /**
   * Sub-package name.
   *
   * Forms the final import path together with the host plugin's Go module path;
   * must match `/^[a-z][a-z0-9_]*$/` — a lowercase ASCII letter followed by
   * lowercase letters, digits, or underscores — and be unique within one
   * plugin build.
   */
  name: string;

  /**
   * Absolute path to the contributor's Go source directory.
   *
   * Every `.go` file under this directory is copied into the scratch build tree
   * as a sub-package of the host plugin's module. Subdirectories are copied
   * recursively; `go.mod` files, `node_modules`, and `.git` are pruned.
   */
  source: string;
}
