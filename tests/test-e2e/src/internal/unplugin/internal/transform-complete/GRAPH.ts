/**
 * Scenarios for the dependency-completeness contract (samchon/ttsc#720).
 *
 * A plugin that knows exactly which declarations it consulted can list a
 * transformed file in the envelope's `dependenciesComplete`. The adapter then
 * derives `dependencies[F] ∪ graph.configs` for it instead of the union with
 * the host-owned `reach(graph.edges, F) ∪ graph.globals` bound, which is the
 * only way a consumer can invalidate below language-semantic reachability.
 */

/** The reference graph every scenario reports, so one shape pins one behavior. */
export const GRAPH = {
  // main -> unread -> deep proves the whole reach closure drops for a declared
  // file, not only the direct edge. The other.ts edge belongs to the mixed
  // scenario's unmarked file.
  edges: {
    "src/main.ts": ["src/consulted.d.ts", "src/unread.d.ts"],
    "src/unread.d.ts": ["src/deep.d.ts"],
    "src/other.ts": ["src/other-type.d.ts"],
  },
  globals: ["src/ambient.d.ts"],
  configs: ["tsconfig.json"],
};
