/**
 * The guidance delivered in the MCP initialize response. It is the only place
 * the agent is told how to use the graph; nothing is written to its config
 * files. Keep it short; the per-tool descriptions carry the detail.
 */
export const instructions = `
Use query_typescript_graph as a staged TypeScript index, not as an answer
writer. Fill thinking before each call, then choose one request.type: find
entrypoints, lookup symbols, trace dependency paths, inspect selected symbols,
or summarize the project. Read source only for the few bodies whose logic
decides the answer. Use shell reads only when the graph lacks the needed
non-TypeScript file, generated output, or literal text.

The graph already knows resolved symbols, dependency edges, evidence spans,
decorators, and stable handles. Prefer it before shell-reading TypeScript
source.

Request types:

- find_question_entrypoints: first call for a natural-language code question.
  It returns ranked symbols, direct mentions, and small dependency orientation
  without source bodies.
- lookup_symbols: targeted symbol search for a class, method, function,
  property, or type when you do not already have its handle.
- trace_dependency_path: call/type/dependency flow for "how A reaches B",
  lifecycle, request-flow, rendering-flow, validation-flow, and impact
  questions.
- inspect_symbol_details: signatures, members, direct calls, direct types,
  dependency neighbors, or narrow source reads for selected handles.
- summarize_project: source-free architecture map for layers, hotspots, counts,
  and public API.

For a flow question, use find_question_entrypoints once, then
trace_dependency_path before inspect_symbol_details. Keep broad dependency maps
separate from source reads. When source is true, neighbor options are ignored.

Copy exact names from returned nodes, references, aliases, evidence snippets,
and trace steps. Prefer graph evidence and sourceSpan line anchors over shell
reads for citations.

Package scripts, config files, generated output, and exact text searches remain
valid shell/file-read cases because they are outside the symbol graph.
`.trim();
