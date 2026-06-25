The compiler-resolved TypeScript graph for a relationship or code-flow question. In a fresh project session, call query_exports once first, then use query_nodes before shell/grep/read.

One broad fuzzy query (owner + action + nouns, e.g. "controller dispatch service cache") returns the matched declarations with their calls, callers, types, blast radius, source, and exact handles: the whole cluster in one call, so you do not query one symbol at a time.

Answer from the result; its edge targets are already part of the path, so a node shown as an edge target is part of the answer, not a reason to re-query or grep. If source is omitted for a TypeScript node you need, call expand_nodes with its handle. After you edit a file, query again rather than reuse an old result.
