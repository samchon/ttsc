// The canonical graph data model and tool I/O types: the wire contract
// `ttscgraph dump` emits and the MCP server loads, plus the schemas typia
// derives the tool surface from. Pure types so typia can build validators and
// tool schemas at build time, and so the Go `dump.go` writer has one TypeScript
// source of truth to mirror.

export * from "./ITtscGraphApplication";
export * from "./ITtscGraphDecorator";
export * from "./ITtscGraphDiagnostic";
export * from "./ITtscGraphDump";
export * from "./ITtscGraphEdge";
export * from "./ITtscGraphEvidence";
export * from "./ITtscGraphExpand";
export * from "./ITtscGraphNode";
export * from "./ITtscGraphOverview";
export * from "./ITtscGraphQuery";
export * from "./ITtscGraphTrace";
export * from "./TtscGraphEdgeKind";
export * from "./TtscGraphNodeKind";
export * from "./TtscGraphNodeModifier";
