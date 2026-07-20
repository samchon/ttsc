package graph

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

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
  // NodeModule is a source file with an export table — the surface a consumer
  // imports from. A barrel declares nothing, so this is the only node it has,
  // and it is the node a package.json entry path resolves to.
  NodeModule NodeKind = "module"
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
  // Closure marks a node declared inside another declaration's body — Vue's
  // `baseCreateRenderer.patch`, a callback bound to a const inside a method.
  // It is a name the runtime calls, and a model that asks for it by name gets
  // it; but an orientation tour ranks and walks the surface, so the surface is
  // what it sees. The flag is how a projection tells the two apart.
  Closure bool
  // Modifiers holds the declaration's syntactic modifiers as wire strings (a
  // subset of the TtscGraphNodeModifier union: export/default/declare/abstract/
  // static/readonly/async/const/public/private/protected). It is recorded from
  // the declaration's combined modifier flags during the build pass and emitted
  // for projections that filter on visibility and shape.
  Modifiers []string
  // Literals is the complete value set of a type alias or enum whose declared
  // type the checker resolved to literals, each rendered in TypeScript source
  // form ("a", 1, true, null). It is set only when every constituent is
  // enumerable, so a present list is the whole type and never a sample of it;
  // a union that mixes in `string`, a type parameter, or a computed enum member
  // has no complete answer and gets none.
  //
  // It is a checker fact because nothing else is sound. The value set was read
  // off the declaration's source text for a while, which made the answer a
  // function of line wrapping rather than of the type: a union written one
  // member per line reported the members that fit in the snippet, an enum
  // written across lines reported nothing at all, and `type I = Kind | 'f'`
  // reported `'f'` while the members reaching it through `Kind` vanished (#732).
  // The checker has already resolved every one of them, indirection included.
  Literals []string
  // EnumMembers is what an enum declares, in checker order: the name a caller
  // writes and the value it carries. Empty for every other kind.
  //
  // The enum's node was always here and had nothing in it. `literals` says what
  // values the enum admits, which answers a serializer; the code says
  // `Colors.Red`, so a caller that had already named the enum still opened the
  // file to learn what to type (#738). The members are not nodes of their own —
  // `Colors.Red` is a literal string a grep finds exactly, and minting a node
  // per member would grow the graph and put leaves into tour flows to index
  // what grep already does. This fills in the node that exists instead.
  EnumMembers []EnumMember
  // ObjectMembers is the direct, statically named outline of an object literal
  // assigned to this variable. It is captured from the compiler AST, in source
  // order, so comments and lexical trivia cannot change member identity. The
  // positions point into the same Program-owned source snapshot NewDump uses to
  // render the compact signature and line carried on the wire.
  ObjectMembers []ObjectMember
  // Pos and End bound the declaration in its source file (byte offsets). They
  // are for display, never identity, so an edit that shifts them does not re-key
  // the node.
  Pos                int
  End                int
  ImplementationFile string
  ImplementationPos  int
  ImplementationEnd  int
}

// EnumMember is one member of an enum: the name a caller writes and the value
// it carries, in TypeScript source form. Value is empty when the checker could
// not fold the member's initializer to a constant.
type EnumMember struct {
  Name  string
  Value string
}

// ObjectMember is one direct, statically named property, method, or accessor of
// an object-literal variable. A spread has no declaration name of its own and a
// dynamic computed key cannot be named soundly, so neither fabricates a member.
type ObjectMember struct {
  Name string
  Kind NodeKind
  Pos  int
  End  int
  // SignatureEnd is the AST boundary before a nested value body. When the
  // boundary lands at an opening token's full start, SignatureTokenLen says how
  // many source bytes belong to the outline (`{`, `[`, or `class`). A true
  // SignatureBoundary permits whitespace-normalizing a multiline declaration
  // through that safe endpoint; otherwise the outline stops at its first line.
  SignatureEnd      int
  SignatureBoundary bool
  SignatureTokenLen int
}

// EdgeKind classifies a relationship between two nodes.
type EdgeKind string

const (
  // EdgeHeritage is an `extends` / `implements` relationship from a class or
  // interface to a base it derives from.
  EdgeHeritage EdgeKind = "heritage"
  // EdgeMemberRelation is a checker-verified relationship from a directly
  // declared member to the directly declared base member it implements or
  // overrides. Origin is "implements" or "overrides" and becomes the wire
  // kind. Keeping this separate from EdgeHeritage prevents a member fact from
  // being confused with the syntactic container clause that led the checker to
  // compare the two types.
  EdgeMemberRelation EdgeKind = "member-relation"
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
  // EdgeExports runs from a module to a declaration its export table resolves
  // to, through re-exports and barrels. It records which surface a symbol is
  // public on, which the Exported flag cannot: a package's front door and its
  // legacy subpath both export, and only the edge says which one did.
  EdgeExports EdgeKind = "exports"
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
  // "jsx", or "tagged"; for EdgeHeritage it is "extends" or "implements";
  // for EdgeMemberRelation it is "implements" or "overrides".
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
  seen map[edgeKey]struct{}

  // resolved memoizes the checker resolution of an AST node for the length of a
  // build: the edge pass visits the same node several times, and a resolution
  // cannot change while the program is fixed.
  resolved map[*shimast.Node]*Target
}

// edgeKey identifies an edge by its two ends and the wire kind it will surface
// as: a comparable struct, so the dedup set costs no allocation per candidate.
type edgeKey struct {
  from string
  to   string
  kind string
}

// nodeID builds the position-invariant identity for a symbol named name,
// declared as kind in the source file at path. The visible grammar remains
// path#name:kind, but path and name quote a literal backslash and hash so a
// consumer never has to guess which hash separates the two components.
func nodeID(path string, name string, kind NodeKind) string {
  return escapeNodeIDPart(path) + "#" + escapeNodeIDPart(name) + ":" + string(kind)
}

// nodeIDParts are the structured facts carried by a symbol id. File nodes are
// raw paths rather than symbol ids, so parseNodeID deliberately rejects them.
type nodeIDParts struct {
  path string
  name string
  kind NodeKind
}

// parseNodeID recovers the structured path, name, and kind from an id emitted
// by nodeID. It also accepts older ids whose ordinary components were not
// escaped, so a newer reader can still consume a pre-codec dump.
func parseNodeID(id string) (nodeIDParts, bool) {
  hash := nodeIDHash(id)
  if hash < 0 {
    return nodeIDParts{}, false
  }
  tail := id[hash+1:]
  colon := strings.LastIndex(tail, ":")
  if colon <= 0 || colon == len(tail)-1 {
    return nodeIDParts{}, false
  }
  return nodeIDParts{
    path: unescapeNodeIDPart(id[:hash]),
    name: unescapeNodeIDPart(tail[:colon]),
    kind: NodeKind(tail[colon+1:]),
  }, true
}

// nodeFile recovers the raw source path embedded in a symbol id. An id without
// a symbol component is a file id, and therefore has no node-file component.
func nodeFile(id string) string {
  parts, ok := parseNodeID(id)
  if !ok {
    return ""
  }
  return parts.path
}

// NodeFile is the graph-symbol provider's shared view of the node-id grammar.
// Keeping the parser here prevents its LSP path comparison from drifting from
// the dump producer's edge-evidence lookup.
func NodeFile(id string) string {
  return nodeFile(id)
}

func escapeNodeIDPart(value string) string {
  value = strings.ReplaceAll(value, "\\", "\\\\")
  return strings.ReplaceAll(value, "#", "\\#")
}

func unescapeNodeIDPart(value string) string {
  var out strings.Builder
  out.Grow(len(value))
  for i := 0; i < len(value); i++ {
    if value[i] == '\\' && i+1 < len(value) {
      next := value[i+1]
      if next == '#' || (next == '\\' && !legacyUNCStart(value, i)) {
        i++
      }
    }
    out.WriteByte(value[i])
  }
  return out.String()
}

// legacyUNCStart distinguishes an older raw UNC path (\\server) from a new
// codec spelling (\\\\server). The former predates backslash escaping and must
// remain readable by a current consumer.
func legacyUNCStart(value string, index int) bool {
  return index == 0 && len(value) > 2 && value[2] != '\\' && value[2] != '#'
}

func nodeIDHash(id string) int {
  for i := 0; i < len(id); i++ {
    if id[i] != '#' {
      continue
    }
    if i == 0 || id[i-1] != '\\' || escapedBackslash(id, i-1) {
      return i
    }
  }
  return -1
}

// escapedBackslash reports whether slash is itself escaped by the run before
// it. Only an odd run quotes the following hash.
func escapedBackslash(id string, slash int) bool {
  count := 0
  for i := slash; i >= 0 && id[i] == '\\'; i-- {
    count++
  }
  return count%2 == 0
}
