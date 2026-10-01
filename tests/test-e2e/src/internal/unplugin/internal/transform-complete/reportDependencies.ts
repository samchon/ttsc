/** Plugin entry reporting `dependencies` for `src/main.ts`. */
export function reportDependencies(dependencies: string[]): unknown {
  return {
    transform: "./plugin.cjs",
    name: "reporter",
    operation: "emit-dependencies",
    dependencies,
  };
}
