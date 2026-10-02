package graph

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// NodeKind classifies a graph node by what its symbol declares.
//
// @evidence contracts/common.md#principled-implementation String discriminants distinguish compiler declaration kinds from separately published artifact kinds.
// @evidence contracts/common.md#clear-and-simple-design One vocabulary carries internal and wire classifications without a second ordinal mapping.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Named constants express the product schema rather than consumer-specific ranking exceptions.
// @evidence contracts/common.md#meaningful-documentation Native kind comments explain callable members, modules and artifact boundaries, with documentation-skill spacing before these type tags.
// @evidenceExclude contracts/performance.md#efficient-algorithms This discriminant type chooses no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A kind value coordinates no shared computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A kind value owns no retained resource.
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
  // The artifact kinds. These are not declarations and they are not this
  // Program's facts: a plugin materialized them from a Markdown document, a
  // Prisma schema, or an API document, and the graph indexes what it was handed
  // without interpreting any of it. Their ids are the address a citation names
  // rather than the `path#name:kind` grammar, which is why a consumer parsing an
  // id gates on the kind first.
  NodeMarkdownDocument NodeKind = "markdown_document"
  NodeMarkdownSection  NodeKind = "markdown_section"
  NodePrismaModel      NodeKind = "prisma_model"
  NodePrismaColumn     NodeKind = "prisma_column"
  NodePrismaRelation   NodeKind = "prisma_relation"
  NodeSwaggerOperation NodeKind = "swagger_operation"
)

// Node is one declared symbol. Its ID is position-invariant, built from the file
// realpath, the declared name, and the kind, so inserting a line above a
// declaration does not re-key it. That keeps a future incremental layer from
// churning the whole graph on every edit, which a byte-offset key would force.
//
// @evidence contracts/common.md#principled-implementation Stable identity is separate from source spans; declared simple-name presence distinguishes valid empty member names from unavailable names.
// @evidence contracts/common.md#clear-and-simple-design Compiler facts, artifact metadata and implementation locations remain explicit fields, with interpretation owned by consumers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No project-specific ranking, generated answer or foreign-state override is encoded in this declaration record.
// @evidence contracts/common.md#meaningful-documentation Native member comments explain identity, optional facts, source units and implementation ownership, keeping documented members and tags separated under the documentation skill.
// @evidenceExclude contracts/performance.md#efficient-algorithms The node is a fact container, not the owner of build or projection algorithms.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Graph generation owners establish reuse of these facts.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Node lifetime is owned by its graph generation; the record acquires no handle or cache independently.
type Node struct {
  ID   string
  Name string

  // Simple is the unqualified declared name (`create`, `OrderService`), taken
  // straight from the declaration's symbol. Name may join an owner chain to a
  // member with a single dot, and a quoted member name can itself contain a dot
  // (`"a.b"` → Name `C.a.b`), so the simple/qualified boundary cannot be
  // recovered from Name by splitting on a dot. Recording it here keeps the dump
  // split exact instead of guessing.
  Simple string

  // HasSimple records an actual compiler-bound declaration name, including the
  // valid empty string member name. Nonempty Simple remains sufficient for
  // callers that construct ordinary nodes without this presence flag.
  HasSimple bool

  Kind NodeKind
  File string

  // ArtifactLine is the 1-based line a published artifact starts on, and is 0
  // for every declaration — a declaration carries a real span, resolved from the
  // compiler, and does not need this. It exists because an artifact has no AST
  // position to take a span from: the plugin that parsed the document reports
  // where the heading is, and that single number is the whole span an index
  // carries. The section's content is read from the file when someone needs it,
  // exactly as a function body is.
  ArtifactLine int

  // ArtifactParent is the id of the artifact containing this one — a section's
  // document or enclosing section, a column's model. Empty for every
  // declaration, whose containment the TypeScript memory layer synthesizes.
  ArtifactParent string

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
  // It is a checker fact because nothing else is sound. Reading the value set
  // off the declaration's source text makes the answer a function of line
  // wrapping rather than of the type: a union written one member per line would
  // report the members that fit in the snippet, an enum written across lines
  // nothing at all, and `type I = Kind | 'f'` would report `'f'` while the
  // members reaching it through `Kind` vanish. The checker has already resolved
  // every one of them, indirection included.
  Literals []string

  // EnumMembers is what an enum declares, in checker order: the name a caller
  // writes and the value it carries. Empty for every other kind.
  //
  // `literals` says what values the enum admits, which answers a serializer;
  // the code says `Colors.Red`, so a caller that had already named the enum
  // would still open the file to learn what to type. The members are not nodes
  // of their own — `Colors.Red` is a literal string a grep finds exactly, and
  // minting a node per member would grow the graph and put leaves into tour
  // flows to index what grep already does. This fills in the node that exists
  // instead.
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
  Pos int

  End int

  // SignatureEnd bounds the declaration head — everything up to where the body
  // opens. A consumer that guessed the boundary by scanning physical lines both
  // leaked implementation text when a declaration shared its line with its body
  // and stopped early when the head itself contained a brace, because a line is
  // not a declaration boundary and a brace is not always a body. The compiler
  // knows where the body starts, so it says so here. Zero when the declaration
  // has no body to bound, in which case the whole declaration is the head.
  SignatureEnd int

  ImplementationFile string
  ImplementationPos  int
  ImplementationEnd  int
}

// EnumMember is one member of an enum: the name a caller writes and the value
// it carries, in TypeScript source form. Value is empty when the checker could
// not fold the member's initializer to a constant.
//
// @evidence contracts/common.md#principled-implementation The declared name, including an empty string, remains distinct from an optional checker-folded TypeScript value.
// @evidence contracts/common.md#clear-and-simple-design One ordered record supplies enum outline data without manufacturing member graph nodes.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Values are producer facts rather than guesses from enum spelling or fixture expectations.
// @evidence contracts/common.md#meaningful-documentation Native prose states TypeScript value rendering and the absent-value meaning, using documentation-skill tag separation.
// @evidenceExclude contracts/performance.md#efficient-algorithms This record chooses no folding algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The compiler and graph generation own value reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This record has no independent retained-state lifecycle.
type EnumMember struct {
  Name  string
  Value string
}

// ObjectMember is one direct, statically named property, method, or accessor of
// an object-literal variable. A spread has no declaration name of its own and a
// dynamic computed key cannot be named soundly, so neither fabricates a member.
//
// @evidence contracts/common.md#principled-implementation Static AST identity and explicit signature boundaries preserve direct object members without treating spreads or dynamic keys as named declarations.
// @evidence contracts/common.md#clear-and-simple-design Outline facts remain on the owning variable node and source-body boundaries are represented separately from identity.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No brace-counting source heuristic or fixture-specific member name defines the stored surface.
// @evidence contracts/common.md#meaningful-documentation Native comments explain excluded dynamic members, byte spans and opening-token inclusion, with documentation-skill spacing.
// @evidenceExclude contracts/performance.md#efficient-algorithms Collection and rendering own algorithms; this declaration holds their facts.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The producing graph snapshot owns reuse of member facts.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The containing node owns lifetime; this record acquires no independent resource.
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
  SignatureEnd int

  SignatureBoundary bool
  SignatureTokenLen int
}

// EdgeKind classifies a relationship between two nodes.
//
// @evidence contracts/common.md#principled-implementation Distinct relationship kinds preserve runtime uses, type references, documentation mentions and exports without conflating their semantics.
// @evidence contracts/common.md#clear-and-simple-design Internal kinds pair with Origin only where the wire needs a finer relationship distinction.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The vocabulary states supported graph relations and contains no consumer-specific reachability exception.
// @evidence contracts/common.md#meaningful-documentation Native constant comments explain each relationship's meaning and boundary, with tags separated under the documentation skill.
// @evidenceExclude contracts/performance.md#efficient-algorithms A relationship discriminant selects no traversal strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The value does not own shared computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The value owns no retained state or resource.
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
  // EdgeDocRef is a reference from a declaration to a symbol its own
  // documentation names through an inline link. The checker resolves the name
  // and counts it as a use — an import that exists only to support one survives
  // `noUnusedLocals` — so the relationship is a compiler fact like every other
  // edge here.
  //
  // It is its own kind rather than a type-ref because it is not a type
  // position: a link may name a function, and a consumer filtering type edges
  // from value edges would be told a documentation mention is one or the other
  // when it is neither. The tag around the link decides nothing; a link under
  // `@evidence`, under `@see`, or in ordinary prose is one relation.
  EdgeDocRef EdgeKind = "doc-ref"
  // EdgeExports runs from a module to a declaration its export table resolves
  // to, through re-exports and barrels. It records which surface a symbol is
  // public on, which the Exported flag cannot: a package's front door and its
  // legacy subpath both export, and only the edge says which one did.
  EdgeExports EdgeKind = "exports"
)

// EdgeKinds returns every kind Build can put on an edge, in declaration order.
//
// A consumer that reports per-kind numbers needs the whole vocabulary rather
// than the subset a particular project happens to contain: counting only what
// was seen makes the reported shape depend on the project measured, and a
// family that dropped to zero disappears instead of reading zero.
//
// @evidence contracts/common.md#principled-implementation Returning the complete declared vocabulary preserves zero-count relationship families independently of one project's observed edges.
// @evidence contracts/common.md#clear-and-simple-design A fixed ordered slice gives callers an explicit enumeration without inferring it from graph contents.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Contract-defined kind constants replace no measurements or consumer-specific expected counts.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain complete-vocabulary and zero-count reporting semantics, following the documentation skill.
// @evidence contracts/performance.md#efficient-algorithms The output has fixed schema-bounded size and requires no graph scan.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This vocabulary constructor owns no repeated computation; returning an independent slice prevents caller mutation of shared enumeration storage.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The slice transfers to the caller and no cache or resource is retained.
func EdgeKinds() []EdgeKind {
  return []EdgeKind{
    EdgeHeritage,
    EdgeMemberRelation,
    EdgeValueCall,
    EdgeValueAccess,
    EdgeTypeRef,
    EdgeDocRef,
    EdgeExports,
  }
}

// Edge is a directed, checker-resolved relationship from one node to another,
// both referenced by Node.ID. File, Pos, and End bound the source expression
// that produced the edge. File is empty when the From node names it and is set
// only when an assigned implementation attributes an expression in another
// file to the declaration node it implements. They are evidence, not identity;
// a duplicate relationship keeps the first source-order span.
//
// @evidence contracts/common.md#principled-implementation Directed endpoint identity and wire-refining origin are distinct from the source expression used as evidence.
// @evidence contracts/common.md#clear-and-simple-design Optional cross-file evidence records assigned implementations without changing the declaration that owns a relationship.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Relation identity has no fixture-dependent span or synthetic caller override.
// @evidence contracts/common.md#meaningful-documentation Native prose explains first-span deduplication, evidence-file defaults and origin vocabulary, using documentation-skill paragraph and tag spacing.
// @evidenceExclude contracts/performance.md#efficient-algorithms Deduplication belongs to graph construction, not this record.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Generation owners decide reuse of relationships.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The graph owns this value's lifetime and it acquires no independent resources.
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

  File string
  Pos  int
  End  int
}

// Graph is the in-memory adjacency the MCP tools query. Edges are added by the
// resolution pass on top of the declaration nodes Build records.
//
// @evidence contracts/common.md#principled-implementation Declaration nodes and resolved relationships share one generation; explicit build scratch and committed expansion facts preserve their different lifetimes.
// @evidence contracts/common.md#clear-and-simple-design Facts, build-only indices and invalidation metadata are named by responsibility instead of hidden in consumer-owned caches.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The representation contains no fixture graph, ranking cap or foreign compiler mutation mechanism.
// @evidence contracts/common.md#meaningful-documentation Native member comments identify build-only maps, generation reuse and downstream invalidation consumers, with documented-member and tag spacing under the documentation skill.
// @evidenceExclude contracts/performance.md#efficient-algorithms Build and query operations select algorithms; this structure represents their state.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The record exposes indices but does not itself coordinate a build or reuse decision.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources BuildFiles and generation owners acquire and release the represented state; the container has no independent lifecycle operation.
type Graph struct {
  Nodes map[string]*Node
  Edges []*Edge

  // pathCaseInsensitive preserves the producing Program's filesystem identity
  // policy after build-only compiler state is released. Its zero value keeps
  // exact path spellings for a standalone graph without a producing Program.
  pathCaseInsensitive bool

  // Decorators holds the decorators written on the workspace's declarations,
  // captured syntactically so the JSON dump can attach raw facts to each target
  // node and a consumer can interpret `@Controller`/`@Get` conventions without
  // re-parsing source. It is dump-only metadata, separate from Edges so the
  // existing checker-resolved relationships are untouched.
  Decorators []*Decorator

  // DocTags holds the documentation tags TypeScript does not recognize, written
  // on the workspace's declarations and captured verbatim so the JSON dump can
  // attach them to each target node. A convention that attaches a declaration to
  // something outside the type system — a specification section, an API
  // operation, a reference document — writes it here and nowhere the graph could
  // otherwise see. Dump-only metadata, separate from Edges for the same reason
  // Decorators is.
  DocTags []*DocTag

  // docTagPositions deduplicates DocTags by where each tag is written, so a
  // declaration presented to putDeclaredNode more than once contributes its tags
  // once. Build-only, like bodyNodes.
  docTagPositions map[docTagKey]struct{}

  // docHosts are the declarations the node pass found documentation on, paired
  // with the node it attributed them to and keyed by their file. The edge pass
  // resolves documentation links from this set rather than from a walk of its
  // own, so both halves of a citation cover the same declarations, and it asks
  // per file so a project's whole documented population is never rescanned for
  // each one. Build-only.
  docHosts map[string][]docHost

  docHostPositions map[docTagKey]struct{}

  // bodyNodes tracks whether a callable node's display span is the overload
  // implementation rather than an overload signature. It is build-only metadata
  // and intentionally stays out of JSON dumps.
  bodyNodes map[string]bool

  // seen deduplicates edges in O(1) during construction, so building a graph
  // with N edges has expected O(N) set work. edgeKey preserves endpoint and
  // wire-kind components without delimiter ambiguity or joined-string allocation.
  seen map[edgeKey]struct{}

  // resolved memoizes the checker resolution of an AST node for the length of a
  // build: the edge pass visits the same node several times, and a resolution
  // cannot change while the program is fixed.
  resolved map[*shimast.Node]*Target

  // edgeEvidenceFiles temporarily overrides a declaration node's source while
  // an assigned implementation in another file is walked. Builds are
  // single-threaded, and the helper that installs an override restores it
  // before the traversal returns.
  edgeEvidenceFiles map[string]string

  // baseNodes is the immutable endpoint index of the preceding committed
  // generation during a partial build. Nodes owned by selectedFiles are never
  // read through it: a changed file may delete or re-key a declaration, so its
  // old nodes must disappear before the new checker walk begins.
  baseNodes map[string]*Node

  selectedFiles map[string]bool

  // ExportedTargets records every declaration reached through a selected
  // module's checker export table. A partial caller uses it to add re-exported
  // owner files to the same invalidation transaction before publishing.
  ExportedTargets map[string]bool

  // ImplementationSources records every source that assigns a function body
  // to a modeled declaration, including candidates after the first assignment
  // that supplied the node's display span. A partial caller uses the complete
  // set to rebuild a declaration owner and all competing assignments together.
  ImplementationSources map[string]map[string]bool
}

// lookupNode returns a node from this build, then from the preceding committed
// endpoint index when that node's file is not being replaced.
func (g *Graph) lookupNode(id string) (*Node, bool) {
  if node, ok := g.Nodes[id]; ok {
    return node, true
  }
  node, ok := g.baseNodes[id]
  if !ok || g.selectedFiles[node.File] {
    return nil, false
  }
  return node, true
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
//
// @evidence contracts/common.md#principled-implementation The shared escaped node-ID grammar recovers the declaration path while rejecting file-only or malformed identities.
// @evidence contracts/common.md#clear-and-simple-design One public adapter exposes the same parser used by dump evidence and native graph consumers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Legacy UNC handling serves the actual pre-codec identity format, not a fixture-specific path patch.
// @evidence contracts/common.md#meaningful-documentation Native prose explains shared grammar ownership and consumer drift prevention, with documentation-skill tag separation.
// @evidence contracts/performance.md#efficient-algorithms Parsing scans ID bytes linearly and allocates only decoded path/name components.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This parser does not coordinate repeated requests; consumers own any identity index.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No source snapshots or native resources are retained.
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
