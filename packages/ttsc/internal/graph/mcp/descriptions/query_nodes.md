The compiler-resolved TypeScript graph for a relationship or code-flow question. Reach for it first, before shell/grep/read.

One broad fuzzy query (owner + action + nouns, e.g. "repository find manager query builder") returns the matched declarations plus the downstream call path they lead to, following calls and crossing interface dispatch to the concrete implementation, each with its callers, types, blast radius, and source, in one call.

Answer from that one result: the chain down to the underlying work is already in it, so do not query each layer in turn or grep for a body it already shows. After you edit a file, query again rather than reuse an old result.
