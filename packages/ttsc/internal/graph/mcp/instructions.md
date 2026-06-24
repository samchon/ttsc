# ttsc-graph

A compiler-resolved graph of TypeScript relationships: calls, callers, types, ownership, blast radius. It mirrors the code; after an edit, query again, not from an old result.

- **How does code connect?** `query_nodes`: one broad query (owner + action + nouns), before grep.
- **What is in a file, what is near it?** `query_files` with the paths: a roster of its declarations and adjacent files.
- **A file's errors, or the whole project's?** `query_diagnostics`.
- **No match, omitted source, or non-TypeScript?** grep/read.

## Reach for `query_nodes` before grep

**Default to `query_nodes` for any relationship or code-flow question; do not fall into grep-first habits.** Repeated grep/read probes burn tokens reconstructing relationships the graph already resolved.

- One broad query (owner + action + domain nouns, e.g. `repository find manager query builder`) returns the matched declarations with their calls, callers, types, blast radius, and source.
- The fuzzy match is the batch: a broad multi-noun query returns the whole cluster in one call, so you do not query one symbol at a time, and an edge target shown in the result is part of the answer, not a reason to re-query or grep.
- grep/read cannot assemble that, because the answer depends on resolved relationships, not on where a keyword appears.

## Roster a file with `query_files`

**Pass file paths to `query_files` for a cheap roster of each**: the declarations inside it (kind, name, line) and its adjacent files (what it reaches and is reached by), one block per file. Use it to find your way around a file, then `query_nodes` the symbol you care about for its relationships and source. It does not return bodies, so reach for `query_nodes` to see one, never grep or re-read the file for a symbol it already listed.

## Check errors with `query_diagnostics`

**Pass `files` for specific files, or omit it for every current error across the project.** Each finding carries its tsc/lint code and location. `severity` keeps only errors or only warnings. Use the whole-project form after an edit to see what is now broken.

## Fall back to grep/read when the graph cannot answer

**Switch to ordinary search and file reads only when the graph does not fit:**

- No node matches the symbol.
- The result omits source you still need.
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

- Relationship or flow question? `query_nodes` with one broad owner + action + noun query, before any grep.
- Need a file's roster? `query_files` with its path: its declarations and adjacent files.
- A file's errors, or the whole project's? `query_diagnostics` with paths, or none for everything.
- No match, omitted source, non-TypeScript, or literal text search? grep/read.
- Edited a file since exploring? Query again; the result re-checks your edit.
