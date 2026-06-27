/**
 * The guidance delivered in the MCP initialize response. It is the only place
 * the agent is told how to use the graph; nothing is written to its config
 * files. Keep it short; the per-tool descriptions carry the detail.
 */
export const instructions = `
Before answering a TypeScript codebase question, call
inspect_typescript_project_graph_before_answering. It is the code-evidence path:
symbols, dependency paths, sourceSpan line anchors, and narrow source bodies
from the resident project graph. Do not answer from memory, web documentation,
ls, rg, cat, or Get-Content when graph evidence can answer the code question.

The graph is a resident TypeScript fact map, not an answer writer. Fill
arguments in order: question, graphNeed, draft, review, request. Write
draft.reason before draft.type, review it for overfetch and non-graph fallback,
then choose one final request.type:
entrypoints, lookup, trace, details, overview, or escape. If the review shows the
question is about scripts, config, generated output, prose docs, external web
facts, or evidence already in hand, choose escape instead of spending a graph
operation. If more TypeScript evidence is needed, make another graph request
instead of switching to shell search.

For central public API or entrypoint questions, first use overview with
aspect: "publicApi". Choose one exported TypeScript symbol from that result,
then trace or details for its concrete path. Do not start broad public API
questions with a large entrypoints search.

The graph already knows resolved symbols, dependency edges, evidence spans,
decorators, stable handles, source bodies, and sourceSpan line anchors. If you
need exact code or line numbers, use details with source: true on one or two
selected leaf functions or methods. Add lineNumbers: true only when you need
exact in-body citation lines.

For caller or call-site questions, do not use rg. Use trace with direction:
"reverse" or details with neighbors: true; both return edge evidence and line
anchors for the call expression.

Request types:

- entrypoints: compact shortlist for behavior-specific code questions. It returns
  ranked symbols, direct mentions, and small dependency orientation without
  source bodies. Do not use it as the first broad public API map.
- lookup: targeted symbol search for a class, method, function, property, or
  type when you do not already have its handle.
- trace: call/type/dependency flow for "how A reaches B", lifecycle,
  request-flow, rendering-flow, validation-flow, and impact questions.
- details: signatures, members, direct calls, direct types, dependency
  neighbors, or narrow source/sourceSpan reads for selected handles.
- overview: source-free architecture map for layers, hotspots, counts, and
  public API. Use it to choose a central exported TypeScript API or entry point
  without reading package scripts.
- escape: no-op route when the review decides this tool was the wrong evidence
  source or the previous graph result is enough.

For a flow question, use entrypoints once, then trace before details. Keep broad
dependency maps separate from source reads. Prefer compact defaults: small
candidate lists, minimal neighbors, and no source bodies until a symbol is
selected. Raise limits only after a prior graph result was truncated or
ambiguous. When source is true, neighbor options are ignored.

Copy exact names from returned nodes, references, aliases, evidence snippets,
sourceSpan anchors, and trace steps. Do not use shell only to recover TypeScript
line numbers already returned by graph evidence.

Package scripts, config files, generated output, web documentation, and exact
text searches remain valid only when the user asks about those sources directly;
do not use them to answer a TypeScript API or call-path question.
`.trim();
