/**
 * The guidance delivered in the MCP initialize response. It is the only place
 * the agent is told how to use the graph; nothing is written to its config
 * files. Keep it short; the per-tool descriptions carry the detail.
 */
export const instructions = `
Before answering a TypeScript codebase question, call query. It is the
code-evidence path:
symbols, dependency paths, edge evidence ranges, and sourceSpan line anchors
from the resident project graph. Do not answer from assumptions, ls, rg, cat,
or Get-Content when graph evidence can answer the code question.

The graph is a resident TypeScript fact map, not an answer writer. Fill
arguments in order: question, graphNeed, draft, review, request. Write
draft.reason before draft.type, review it for overfetch and non-graph fallback,
then choose one final request.type:
entrypoints, lookup, trace, details, overview, or escape. If the review shows the
question is about scripts, config, generated output, prose docs, or evidence
already in hand, choose escape instead of spending a graph
operation. If more TypeScript evidence is needed, make another graph request
instead of switching to shell search.

Budget graph calls before the first request. Most answers need 1-3 calls, and
four calls is the hard stop for one answer. A fifth graph call means the tool is
being used as a source reader; answer from returned handles/ranges or choose
escape and report the missing span.

For behavior, lifecycle, request-flow, rendering-flow, or validation-flow
questions, start with one default entrypoints call, then one trace from the best
handle, then answer. Use overview only for broad architecture or public API
orientation.

The graph already knows resolved symbols, dependency edges, evidence spans,
decorators, stable handles, and sourceSpan line anchors. Use returned ranges and
handles as the evidence. If implementation text is required to decide a detail,
report the gap and the smallest sourceSpan instead of opening files during the
graph answer.

For caller or call-site questions, do not use rg. Use trace with direction:
"reverse" or details with neighbors: true; both return edge evidence and line
anchors for the call expression.

Request types:

- entrypoints: compact shortlist for behavior-specific code questions. It returns
  ranked symbols, direct mentions, and small dependency orientation without
  implementation text. Do not use it as the first broad public API map.
- lookup: targeted symbol search for a class, method, function, property, or
  type when you do not already have its handle.
- trace: call/type/dependency flow for "how A reaches B", lifecycle,
  request-flow, rendering-flow, validation-flow, and impact questions.
- details: signatures, members, direct calls, direct types, dependency
  neighbors, and sourceSpan anchors for selected handles.
- overview: source-free architecture map for layers, hotspots, counts, and
  public API. Use it to choose a central exported TypeScript API or entry point
  without reading package scripts.
- escape: no-op route when the review decides this tool was the wrong evidence
  source or the previous graph result is enough.

For a flow question, use entrypoints once, then trace before details. Keep
dependency maps compact: default limits first, one to three handles in details,
and no larger limits unless the previous result was truncated and the missing
piece is named. Do not spend graph calls only to find tests; mention tests only
when the returned graph slice already exposes them. Stop once file/symbol/range
evidence is enough to answer.

Copy exact names from returned nodes, references, aliases, evidence ranges,
sourceSpan anchors, and trace steps. Do not use shell to recover TypeScript line
numbers, call targets, or branch details not already returned by graph evidence;
name the missing detail and give the returned range.

Package scripts, config files, generated output, prose documentation, and exact
text searches are separate evidence sources. Use them only when the user asks
about those sources directly; do not use them to answer a TypeScript API or
call-path question.
`.trim();
