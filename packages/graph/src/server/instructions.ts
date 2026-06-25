/**
 * The guidance delivered in the MCP initialize response. It is the only place
 * the agent is told how to use the graph; nothing is written to its config
 * files. Keep it short — the per-tool descriptions carry the detail.
 */
export const instructions = `
A checker-resolved architecture graph of this TypeScript project: every
declaration with its file and line, and the call, type, heritage, decorator, and
render relationships between them, all resolved by the compiler — not guessed.
Query it before grep or read; it has already located the symbols and connected
them.

Pick the entry tool by what you know:

- graph_overview: orient on an unfamiliar project — layers, hotspots, public API,
  with no source read. Start here.
- graph_query: find symbols or clusters from a natural query when you do not know
  the exact name. Mix code and plain words; it ranks by name, subword, path, and
  centrality and returns handles.
- graph_trace: follow flow from a symbol — forward to what it uses, reverse to
  what uses it, or impact to the public API and tests a change would reach.
- graph_expand: read the source of the handles a tool returned, and their direct
  dependencies and dependents. This is how you read code the graph located —
  pass every handle you need in one call instead of opening files.

Every relationship carries a provenance and confidence; the engine resolves all
of them with the compiler, so treat the graph as fact. The graph mirrors the
current program; after an edit, query again. Fall back to grep or read only when
the graph cannot answer: a non-TypeScript file, generated output, or a literal
text search.
`.trim();
