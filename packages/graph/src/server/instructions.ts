/**
 * The guidance delivered in the MCP initialize response. It is the only place
 * the agent is told how to use the graph; nothing is written to its config
 * files. Keep it short — the per-tool descriptions carry the detail.
 */
export const instructions = `
This TypeScript project is already fully indexed: every declaration, with its
file and line, and every call, type, heritage, decorator, and render edge
between them, resolved by the compiler — not guessed. So do not explore it by
reading, grepping, or globbing source files. Make a graph call your FIRST action
on any question about this code, and read source only through graph_expand.

The loop:

1. graph_overview — orient on an unfamiliar project: layers, hotspots, and the
   public API (the exported types, named and ranked). The layers are the
   structure and the public API is the entry surface, so you need not list files
   or open the entry module to orient.
2. graph_query — find symbols from a natural query, even without the exact name
   (mix code and plain words; it ranks by name, subword, path, and centrality).
   The graph holds every symbol in this workspace down to a single field, so
   query for one instead of grepping the tree or node_modules.
3. graph_trace — follow flow from a symbol: forward to what it uses, reverse to
   what uses it, impact to the public API and tests a change reaches.
4. graph_expand — read the located source: pass every handle you need in ONE
   call, never one at a time, and read the result instead of opening the file.

The graph is checker-resolved fact and mirrors the current program (query again
after an edit). It covers the whole workspace, so grep and read are only for what
it cannot hold — a non-TypeScript file, generated output, a dependency under
node_modules, or a literal text search — never for a symbol it can locate.
`.trim();
