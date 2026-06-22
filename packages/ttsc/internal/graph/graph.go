package graph

// NodeKind classifies a graph node by what its symbol declares.
type NodeKind string

const (
  NodeFunction  NodeKind = "function"
  NodeClass     NodeKind = "class"
  NodeInterface NodeKind = "interface"
  NodeTypeAlias NodeKind = "type"
  NodeEnum      NodeKind = "enum"
  NodeVariable  NodeKind = "variable"
)

// Provenance marks how a node or edge was derived. Every relationship in this
// graph is resolved by the in-process type checker, so the single value is a
// trust signal: the inverse of a tree-sitter tool tagging an uncertain edge
// "heuristic".
const Provenance = "checker-resolved"

// Node is one declared symbol. Its ID is position-invariant, built from the file
// realpath, the declared name, and the kind, so inserting a line above a
// declaration does not re-key it. That keeps a future incremental layer from
// churning the whole graph on every edit, which a byte-offset key would force.
type Node struct {
  ID       string
  Name     string
  Kind     NodeKind
  File     string
  External bool
  // Pos and End bound the declaration in its source file (byte offsets). They
  // are for display, never identity, so an edit that shifts them does not re-key
  // the node.
  Pos int
  End int
}

// EdgeKind classifies a relationship between two nodes.
type EdgeKind string

const (
  // EdgeHeritage is an `extends` / `implements` relationship from a class or
  // interface to a base it derives from.
  EdgeHeritage EdgeKind = "heritage"
  // EdgeValueCall is a runtime call from one declaration to the function,
  // method, or constructor it invokes.
  EdgeValueCall EdgeKind = "value-call"
  // EdgeTypeRef is a type-position reference from one declaration to a named
  // type it mentions (a parameter, return, property, or alias type). It is not a
  // runtime call, so an impact query can filter value edges from type edges.
  EdgeTypeRef EdgeKind = "type-ref"
)

// Edge is a directed, checker-resolved relationship from one node to another,
// both referenced by Node.ID.
type Edge struct {
  From string
  To   string
  Kind EdgeKind
}

// Graph is the in-memory adjacency the MCP tools query. Edges are added by the
// resolution pass on top of the declaration nodes Build records.
type Graph struct {
  Nodes map[string]*Node
  Edges []*Edge
}

// nodeID builds the position-invariant identity for a symbol named name,
// declared as kind in the source file at path.
func nodeID(path string, name string, kind NodeKind) string {
  return path + "#" + name + ":" + string(kind)
}
