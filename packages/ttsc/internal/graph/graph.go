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
  // NodeMethod is a class or interface member (a method, constructor, or
  // accessor). Its id is class-qualified ("path#Class.method:method") so a
  // resolved method call lands on the same node the build pass recorded.
  NodeMethod NodeKind = "method"
)

// Node is one declared symbol. Its ID is position-invariant, built from the file
// realpath, the declared name, and the kind, so inserting a line above a
// declaration does not re-key it. That keeps a future incremental layer from
// churning the whole graph on every edit, which a byte-offset key would force.
type Node struct {
  ID   string
  Name string
  // Simple is the unqualified declared name (`create`, `OrderService`), taken
  // straight from the declaration's symbol. Name may join an owner chain to a
  // member with a single dot, and a quoted member name can itself contain a dot
  // (`"a.b"` → Name `C.a.b`), so the simple/qualified boundary cannot be
  // recovered from Name by splitting on a dot. Recording it here keeps the dump
  // split exact instead of guessing.
  Simple   string
  Kind     NodeKind
  File     string
  External bool
  // Exported marks a node that is part of its module's export surface, resolved
  // through the checker's export table so a re-export (`export { Foo } from`) or
  // a barrel (`export *`) counts, not only an inline `export` modifier. It is
  // the signal a public-API projection filters on.
  Exported bool
  // Modifiers holds the declaration's syntactic modifiers as wire strings (a
  // subset of the TtscGraphNodeModifier union: export/default/declare/abstract/
  // static/readonly/async/const/public/private/protected). It is recorded from
  // the declaration's combined modifier flags during the build pass and emitted
  // for projections that filter on visibility and shape.
  Modifiers []string
  // Pos and End bound the declaration in its source file (byte offsets). They
  // are for display, never identity, so an edit that shifts them does not re-key
  // the node.
  Pos                int
  End                int
  ImplementationFile string
  ImplementationPos  int
  ImplementationEnd  int
}

// EdgeKind classifies a relationship between two nodes.
type EdgeKind string

const (
  // EdgeHeritage is an `extends` / `implements` relationship from a class or
  // interface to a base it derives from.
  EdgeHeritage EdgeKind = "heritage"
  // EdgeValueCall is a runtime use from one declaration of the function, method,
  // or constructor it invokes: a call, a `new T()`, a `<Component/>` JSX use, or
  // a tagged-template tag. Uses of a dependency's method are not modeled (the
  // boundary stops at the external type).
  EdgeValueCall EdgeKind = "value-call"
  // EdgeValueAccess is a runtime property/accessor read or write. It is kept
  // separate from calls so architecture flows can follow lazy getter/property
  // behavior without pretending those reads invoke a function.
  EdgeValueAccess EdgeKind = "value-access"
  // EdgeTypeRef is a type-position reference from one declaration to a named
  // type it mentions (a parameter, return, property, or alias type). It is not a
  // runtime call, so an impact query can filter value edges from type edges.
  EdgeTypeRef EdgeKind = "type-ref"
)

// Edge is a directed, checker-resolved relationship from one node to another,
// both referenced by Node.ID. Pos and End bound the source expression in the
// From node's file that produced the edge. They are evidence, not identity; a
// duplicate relationship keeps the first source-order span.
type Edge struct {
  From string
  To   string
  Kind EdgeKind
  // Origin records the syntactic form a value-call or heritage edge came from,
  // so the JSON dump can split one internal kind into the finer schema kinds
  // (calls / instantiates / renders, extends / implements) without the
  // MCP-facing model losing the distinction. It is "" for kinds that need no
  // split (type-ref, value-access). For EdgeValueCall it is "call", "new",
  // "jsx", or "tagged"; for EdgeHeritage it is "extends" or "implements".
  Origin string
  Pos    int
  End    int
}

// Graph is the in-memory adjacency the MCP tools query. Edges are added by the
// resolution pass on top of the declaration nodes Build records.
type Graph struct {
  Nodes map[string]*Node
  Edges []*Edge
  // Decorators holds the decorators written on the workspace's declarations,
  // captured syntactically so the JSON dump can emit `decorates` edges and a
  // consumer can interpret `@Controller`/`@Get` conventions without re-parsing
  // source. It is dump-only metadata, separate from Edges so the existing
  // checker-resolved relationships are untouched.
  Decorators []*Decorator
  // bodyNodes tracks whether a callable node's display span is the overload
  // implementation rather than an overload signature. It is build-only metadata
  // and intentionally stays out of JSON dumps.
  bodyNodes map[string]bool
  // seen deduplicates edges in O(1) during construction, so building a graph
  // with N edges is O(N), not O(N²). Keyed by from\x00to\x00kind.
  seen map[string]struct{}
}

// nodeID builds the position-invariant identity for a symbol named name,
// declared as kind in the source file at path.
func nodeID(path string, name string, kind NodeKind) string {
  return path + "#" + name + ":" + string(kind)
}
