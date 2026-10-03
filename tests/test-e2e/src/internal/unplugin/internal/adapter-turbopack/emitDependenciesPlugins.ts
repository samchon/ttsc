/**
 * Plugin descriptor routing the fixture through the `emit-dependencies`
 * operation with the given dependency entries. Options ride the plugin entry's
 * top level; the protocol forwards the whole entry as the plugin's config.
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
