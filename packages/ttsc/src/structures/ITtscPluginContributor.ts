/**
 * One contributor entry inside `ITtscPlugin.contributors`.
 *
 * The native builder copies `source` into `<scratch>/contrib/<name>/` and adds
 * a blank-import for `<host-module>/contrib/<name>` to the synthesized
 * `ttsc_contributions.go` placed alongside the host's main package.
 *
 * @evidence contracts/common.md#principled-implementation A contributor pairs its validated Go sub-package name with its source directory because the builder embeds packages into the owning host module rather than building separate modules.
 * @evidence contracts/common.md#clear-and-simple-design The two fields expose only the import identity and source population the builder needs; host-module and scratch-layout policy stay with the builder.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The name grammar and no-go.mod rule express Go package composition requirements, without consumer-specific overrides or a prebuilt-binary escape path.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc gives the generated import location, naming restriction, uniqueness and copied-source exclusions; member and tag separation follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native absolute source paths remain distinct from Go import names, whose slash vocabulary and ASCII package-name restriction belong to Go semantics rather than a host filesystem assumption. The builder owns native joins and source copying.
 */
export interface ITtscPluginContributor {
  /**
   * Sub-package name.
   *
   * Forms the final import path together with the host plugin's Go module path;
   * must match `/^[a-z][a-z0-9_]*$/` — a lowercase ASCII letter followed by
   * lowercase letters, digits, or underscores — and be unique within one plugin
   * build.
   */
  name: string;

  /**
   * Absolute path to the contributor's Go source directory.
   *
   * Every `.go` file under this directory is copied into the scratch build tree
   * as a sub-package of the host plugin's module. A top-level `go.mod` is
   * rejected because contributors are packages, not modules. Copied source
   * prunes `node_modules`, `.git`, `.ttsc`, generated workspace files, and
   * local artifact files.
   */
  source: string;
}
