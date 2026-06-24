`ttsc-graph` is the TypeScript compiler's relationship graph: symbols, source, calls, callers, types.

- For code-flow questions, call `graph_explore` before grep/read/shell.
- Ask one broad natural-language query: owner + action + nouns, e.g. `repository find manager query builder`.
- Do not split symbols across calls or use grep/read/shell to trace or confirm returned source.
- Read files only for no match, signatures, or non-TS files.
- Use `graph_diagnostics` for file errors.
