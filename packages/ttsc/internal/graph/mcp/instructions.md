# ttsc-graph

A compiler-resolved graph of TypeScript relationships: calls, callers, types, ownership, blast radius. It mirrors the code; after an edit, query again, not from an old result.

- **Fresh project session?** `query_exports` once first: exported symbols, folders, handles, and relationship counts. Skip only if you already have exact handles from a prior graph result.
- **How does code connect?** after that orientation, `query_nodes`: one broad query (owner + action + nouns), before grep.
- **Need more source for a printed TypeScript node?** `expand_nodes` with its `handle:n:...`.
- **What is in a file, what is near it?** `query_files` with the paths: a roster of its declarations and adjacent files.
- **A file's errors, or the whole project's?** `query_diagnostics`.
- **No match, non-TypeScript, or literal occurrence search?** grep/read.

## Start with exports for orientation

**Call `query_exports` once at the start of a fresh project session.** It is the public-surface index: exported declarations grouped by folder, with kind, file:line, handle, and relationship counts. Use the exact names and handles from it for focused `query_nodes` or `expand_nodes` calls.

Omit `query` on the first pass. Use `query` only to filter the exported surface by name or file, and `offset` only when the result says another page exists. Git-ignored generated files are omitted from this orientation index.

## Reach for `query_nodes` before grep

**After the export orientation, default to `query_nodes` for any relationship or code-flow question; do not fall into grep-first habits.** Repeated grep/read probes burn tokens reconstructing relationships the graph already resolved.

- One broad query (owner + action + domain nouns, e.g. `controller dispatch service cache`) returns the matched declarations with their calls, callers, types, blast radius, and source.
- The fuzzy match is the batch: a broad multi-noun query returns the whole cluster in one call, so you do not query one symbol at a time, and an edge target shown in the result is part of the answer, not a reason to re-query or grep.
- If a result shows the right TypeScript node but omits the body, copy its `handle:n:...` into `expand_nodes`.
- grep/read cannot assemble that, because the answer depends on resolved relationships, not on where a keyword appears.

## Expand exact nodes with `expand_nodes`

**Use `expand_nodes` when `query_nodes` or `query_files` printed the right TypeScript declaration handle but not enough body.** It is deterministic: no fuzzy ranking, no file search, just the graph node(s) you named. For call-path, relation-flow, lifecycle, dispatch, or "how does X reach Y" questions, prefer `mode: "flow"` from the printed handle(s); it stays on downstream value-call/value-access path evidence. Use `mode: "source"` when you need a wider body window for one specific declaration.

## Roster a file with `query_files`

**Pass file paths to `query_files` for a cheap roster of each**: the declarations inside it (kind, name, line, handle) and its adjacent files (what it reaches and is reached by), one block per file. Use it to find your way around a file, then `expand_nodes` the handle you care about for relationships and source. Use `query_nodes` instead when you need fuzzy relationship discovery.

## Check errors with `query_diagnostics`

**Pass `files` for specific files, or omit it for every current error across the project.** Each finding carries its tsc/lint code and location. `severity` keeps only errors or only warnings. Use the whole-project form after an edit to see what is now broken.

## Fall back to grep/read when the graph cannot answer

**Switch to ordinary search and file reads only when the graph does not fit:**

- No node matches the symbol.
- Non-TypeScript context: config, generated output, docs, JSON, other languages.
- You need every literal occurrence of a string.

`ttsc-graph` is a relationship graph, not a text index. Keyword counting and full-file dumps belong to grep and read.

## Re-query freely

**Re-query freely; never ration calls to a fixed number.** Do it when:

- a better entry node appears in the result,
- a needed symbol was missing,
- you have edited a file since the last query.

The one trap is reusing an earlier result: it predates any edit you made after it, so query again instead of trusting what is already in your context.

## Final checklist

- Fresh project session? `query_exports` with no arguments first.
- Relationship or flow question? After that orientation, `query_nodes` with one broad owner + action + noun query, before any grep.
- Need a file's roster? `query_files` with its path: its declarations, handles, and adjacent files.
- Need source for a listed/omitted TypeScript declaration? `expand_nodes` with its handle.
- A file's errors, or the whole project's? `query_diagnostics` with paths, or none for everything.
- No match, non-TypeScript, or literal text search? grep/read.
- Edited a file since exploring? Query again; the result re-checks your edit.
