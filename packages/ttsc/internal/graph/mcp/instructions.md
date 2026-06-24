`ttsc-graph` is the TS compiler graph: symbols, source, calls, callers, types.

- For architecture/code-flow, call `graph_explore` before grep/read/shell.
- Query named symbols, files, or domain nouns; avoid generic words.
- Re-query when following returned symbols/files, narrowing, or after edits.
- Answer from graph when it has source/edges; do not grep/read to confirm.
- Read only for no match, non-TS, edited source, or missing context.
- Use `graph_diagnostics` for file errors.
