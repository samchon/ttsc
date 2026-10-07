/**
 * Build the plugin descriptor list that routes the fixture plugin through the
 * `emit-graph` operation with the given graph section. Plugin options live at
 * the entry top level: the protocol forwards the whole
 * `compilerOptions.plugins[i]` entry as the plugin's config object.
 */
export function emitGraphPlugins(graph: {
  configs?: string[];
  echoTsconfig?: boolean;
  edges?: Record<string, string[]>;
  globals?: string[];
  inputHashes?: Record<string, string | null>;
  inputRealpaths?: Record<string, string | null>;
}): unknown[] {
  return [
    {
      transform: "./plugin.cjs",
      name: "fixture",
      operation: "emit-graph",
      ...graph,
    },
  ];
}
