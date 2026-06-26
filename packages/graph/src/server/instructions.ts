/**
 * The guidance delivered in the MCP initialize response. It is the only place
 * the agent is told how to use the graph; nothing is written to its config
 * files. Keep it short — the per-tool descriptions carry the detail.
 */
export const instructions = `
This TypeScript project is fully indexed by the compiler. Query the graph instead
of reading or grepping source — it has already resolved every symbol and the
relationships between them.

- graph_overview: the architecture — layers, hotspots, public API. Start here.
- graph_query: find any symbol by name or description; each hit carries its
  signature, usually enough to answer without expanding.
- graph_trace: follow a flow forward, reverse, or to its impact; or give \`to\`
  for the path between two symbols — how A reaches B, in one call.
- graph_expand: a symbol's declared shape — its signature, a container's members;
  source:true to read a specific body.

Answer in as few calls as you can. Use grep or read only for what the graph
cannot hold: a non-TypeScript file, generated output, or a literal text search.
`.trim();
