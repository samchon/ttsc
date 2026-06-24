`ttsc-graph` is the TS compiler graph: symbols, source, calls, callers, types.

- For architecture/code-flow, prefer `graph_explore` before grep/read.
- Query named symbols, files, or domain nouns; avoid generic words.
- Re-query when following returned symbols/files, narrowing, or after edits.
- Avoid duplicate graph calls; answer from graph when it has source/edges.
- Read only for no match, non-TS, edited source, or missing context.
- Use `graph_diagnostics` for file errors.
