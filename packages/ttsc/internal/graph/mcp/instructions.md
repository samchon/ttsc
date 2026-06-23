`ttsc-graph` is the TypeScript compiler's own map of this codebase, served through the `graph_explore` and `graph_diagnostics` tools. It already knows every symbol, what each one calls, what calls it, the types it touches, and what a change to it would break: the exact resolution the type checker uses, not a guess from text.

For any question about how the code works, start with `graph_explore`. One call returns the structure that text search can only approximate, and it is the fastest, most accurate way in.

## Why graph_explore goes first

- One call returns the line-numbered source of every symbol you name, plus its full call graph and types. The structure that would take a dozen grep-and-read round-trips comes back at once.
- It is exact, and it follows what text cannot: a call through a callback, JSX, a React re-render, dynamic dispatch, a barrel re-export, a path alias, or across workspace packages. grep matches text, so it cannot see these edges; the checker resolves them.

## Make one broad call

Name every symbol the question involves in a single `graph_explore` query, for example `render update canvas Scene Renderer`. That one call is usually the whole answer. To go further, widen the query with more names rather than calling once per symbol.

## Then Read and Grep for the detail

The graph hands you structure and an exact `file:line` for every symbol it resolves. From there, Read and Grep do the close-up work the graph is not for: reading a specific implementation line by line, a config or doc the graph does not index, a quick string search. That is their lane, and a good one — reach for them there.

Where they do not help is re-deriving an edge the graph already resolved. If `graph_explore` reported that A calls B, that is the type checker's own answer; a follow-up grep can only be less precise, not more. Spend the grep on reading the code at the line it pointed you to, not on re-checking the map.

For one file's errors, call `graph_diagnostics`: TypeScript errors plus the project's `@ttsc/lint` and transform-plugin findings.
