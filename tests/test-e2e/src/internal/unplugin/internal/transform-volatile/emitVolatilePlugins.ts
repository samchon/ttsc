/**
 * Plugin descriptor list routing the fixture plugin through the `emit-volatile`
 * operation: the plugin declares the given files volatile and embeds a per-run
 * nanosecond timestamp into its output, so a replayed cache entry is observably
 * stale.
 */
export function emitVolatilePlugins(volatile: string[]): unknown[] {
  return [
    {
      transform: "./plugin.cjs",
      name: "fixture",
      operation: "emit-volatile",
      volatile,
    },
  ];
}
