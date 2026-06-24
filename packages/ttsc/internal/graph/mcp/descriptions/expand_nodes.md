Exact expansion for handles printed by `query_nodes` or `query_files`. Use this when a graph result shows the right TypeScript declaration without enough source.

For call-path, relation-flow, lifecycle, dispatch, or "how does X reach Y" questions, prefer `mode: "flow"` on the printed handle(s): it keeps following value-call/value-access edges and avoids unrelated helper bodies. Use `mode: "source"` only when you need a wider body window for a specific declaration, for example to edit or quote the implementation. Do not grep/read a printed TypeScript path just to reopen it.
