import { GoSourceInputs } from "./GoSourceInputs";

/**
 * Whether a directory below a plugin source directory, named `name`, never
 * contributes plugin source: `node_modules`, `.git`, and ttsc's own `.ttsc`.
 *
 * Nothing below such a directory can change the source's digest
 * (`pluginSourceDigest`), so a consumer observing a plugin source directory as
 * a subtree passes over it rather than watching a nested package tree or a
 * repository's object store (samchon/ttsc#1487).
 *
 * @param name The directory's own name, not its path.
 */
export function prunesPluginSourceDirectory(name: string): boolean {
  return GoSourceInputs.shouldPruneDirectory(name);
}
