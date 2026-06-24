`ttsc-graph` is the TS compiler graph: symbols, source, calls, callers, types.

- Prefer `graph_explore` for TS architecture/code-flow before grep/read.
- Query named symbols/files/domain nouns; avoid generic words.
- Broad query: synthesize from first relevant result.
- Re-query only for missing symbol/file, narrower follow-up, or edits.
- Do not chase every edge; avoid duplicate graph/read calls.
- Read only for no match, non-TS, edited source, or missing context.
- Use diagnostics for file errors.
