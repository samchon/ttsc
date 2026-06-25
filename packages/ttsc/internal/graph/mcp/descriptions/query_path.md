Exact runtime path index between named TypeScript symbols. Use this when the task gives a start and end symbol, or an ordered call chain.

It resolves anchors to compiler-known graph nodes and searches the resident in-memory value-call/value-access graph. It returns the ordered path node coordinates, the runtime edges between them, and the off-path declarations each path node calls with their handles, so you can expand the whole neighborhood in one batch instead of discovering helper handles with a separate query. Use query_nodes first when the endpoints are unknown.
