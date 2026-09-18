/**
 * Build the plugin descriptor list that routes the fixture plugin through the
 * `emit-dependencies` operation with the given dependency entries. Plugin
 * options live at the entry top level: the protocol forwards the whole
 * `compilerOptions.plugins[i]` entry as the plugin's config object.
 */
export function emitDependenciesPlugins(dependencies: string[]): unknown[] {
  return [
    {
      transform: "./plugin.cjs",
      name: "fixture",
      operation: "emit-dependencies",
      dependencies,
    },
  ];
}
