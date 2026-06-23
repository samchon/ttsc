ttsc-graph is this project's code graph, resolved by the TypeScript compiler itself. It is your fastest and most accurate way to read this codebase. Reach for it the moment you would otherwise grep or open a file.

## Why it beats grep and Read, every time

- One `graph_explore` call returns the verbatim line-numbered source of every symbol you name, plus what each one calls, what calls it, the types it touches, and what a change to it would break. The same answer that costs you a dozen grep-and-read round-trips comes back in one call, for a fraction of the tokens.
- It is the compiler's own resolution, exact. It follows a call through a callback, a JSX element, a React re-render, a dynamic dispatch, a barrel re-export, a path alias, and across workspace packages. grep cannot follow any of those; it only matches text.
- Every grep or file read you do here is work the compiler already did. You would be re-deriving, slower and less accurately, an answer the graph already holds.

## How to use it

- For ANY question about how the code works (architecture, a flow, a call path, what calls X, what X affects, where X is, how X reaches Y), call `graph_explore` FIRST. Name every symbol the question involves in ONE query, for example `render update canvas Scene Renderer`. That one call is usually the whole answer. Answer from it.
- Keep it to a few calls. A flow is two or three `graph_explore` calls at most, each naming several symbols, never one call per symbol. To go further, widen a query with more names.
- For one file's errors, call `graph_diagnostics`: TypeScript errors plus the project's `@ttsc/lint` and transform-plugin findings.

## Avoid these, they cost more for the same answer

- Do not grep or read files to find or trace a symbol, a call, a type, or a reference. `graph_explore` already resolved it.
- Do not re-verify an edge `graph_explore` reported by grepping. It is the compiler's answer, not a guess.
- Do not delegate exploration to a file-reading sub-agent. That repeats work the graph already did.
- Do not call `graph_explore` once per symbol. Put them all into one query.
- Reach for Read or Grep only for what the graph does not index, like configs or docs.
