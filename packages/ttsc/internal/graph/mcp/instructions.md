# ttsc-graph

Use this graph as a TypeScript code index before grep/read. If the task gives an exact start/end or ordered call chain, call `query_path`. If orientation or entrypoint is unclear, call `query_exports`. If relationships are needed but endpoints are unknown, call `query_nodes`. Use `expand_nodes` only after a handle. Use grep/read only for non-TypeScript, literal search, or no graph match.

The graph mirrors the current program. Query again after edits instead of reusing an old result.

## Tool Choice

- `query_path`: exact A-to-B runtime path through value calls and value access. Pass `from`, `to`, and `via` when the prompt gives intermediate symbols.
- `query_exports`: public surface orientation. It returns exported declarations and public members with names, kinds, files, lines, handles, and aliases.
- `query_nodes`: relationship discovery when exact endpoints are not known. Use one focused query with the relevant symbol, owner, action, or domain terms.
- `expand_nodes`: exact source follow-up for handles returned by graph tools. Use it only when node coordinates are not enough and source context is required, and pass every handle you need in one call instead of one per call.
- `query_files`: file roster. Use it for declarations and adjacent files around known paths.
- `query_diagnostics`: current project diagnostics, optionally filtered by file and severity.

## Fallbacks

Use ordinary grep/read when the graph cannot answer: no matching node, non-TypeScript files, generated output, docs, JSON, or literal occurrence search.
