package graph

import (
  "bufio"
  "encoding/json"
  "io"
  "sort"
  "strings"
)

// dump.go projects a built graph onto the JSON wire contract `ttscgraph dump`
// prints: the IGraphDump shape the @ttsc/graph engine loads (and the 3D viewer
// reduces). The internal Node/Edge model stays narrow (so the resident MCP path
// is untouched); the richer schema is produced here:
//
//   - internal node kinds map straight through (NodeTypeAlias is already "type");
//   - one EdgeValueCall splits by Origin into "calls" / "instantiates" /
//     "renders", EdgeHeritage into "extends" / "implements", and
//     EdgeMemberRelation into "implements" / "overrides";
//   - byte spans become 1-based line/col Evidence ranges;
//   - decorator facts ride on their target node;
//   - file paths use one portable, injective project coordinate and the output
//     is sorted, so the dump is deterministic and diffable.
//
// Structural derivations the schema also defines (file nodes, contains/exports
// edges) are left to the TypeScript loader, which has the node set in hand and
// is where that logic lives.

// DumpEvidence is a 1-based source span grounding a node declaration or an edge
// expression. It is display/expansion only, never identity.
//
// File is omitted when the reader reconstructs it exactly: a node's span is in
// the node's file, and an ordinary edge's span is in the file its `from` id
// names. Cross-file assigned implementations keep the actual evidence file. The
// path is long and would otherwise ride the wire once per node and once per
// edge, on a document that then has to be encoded, piped, parsed and validated.
// An `implementation` span keeps its file — that one
// can genuinely live in another file from the declaration that owns it.
//
// @evidence contracts/common.md#principled-implementation One-based line/column spans ground displayed facts while optional File preserves the owner-reconstructible versus cross-file distinction.
// @evidence contracts/common.md#clear-and-simple-design The wire record carries location evidence independently from node identity.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Optional file omission is a reconstructible schema rule rather than a project-specific payload shortcut.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain coordinate units, file reconstruction and implementation spans, following documentation-skill tag separation.
// @evidence contracts/portability.md#os-neutral-implementation File is a portable dump coordinate, never an OS-wide case-folded identity inferred by this record.
// @evidenceExclude contracts/performance.md#efficient-algorithms This span container selects no coordinate algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The dump context owns reusable line indices.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The enclosing payload owns this span's lifetime.
type DumpEvidence struct {
  File      string `json:"file,omitempty"`
  StartLine int    `json:"startLine"`
  StartCol  int    `json:"startCol,omitempty"`
  EndLine   int    `json:"endLine,omitempty"`
  EndCol    int    `json:"endCol,omitempty"`
}

// DumpDecoratorArgument is one decorator argument; Literal is set only for a
// statically-resolved string or boolean literal.
//
// @evidence contracts/common.md#principled-implementation Optional Literal preserves only the statically supported decorator argument facts without asserting runtime evaluation.
// @evidence contracts/common.md#clear-and-simple-design One wire field mirrors the internal argument boundary.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The record encodes no framework-specific argument inference.
// @evidence contracts/common.md#meaningful-documentation Native prose defines literal availability and supported value kinds under the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A JSON decorator value has no native path or process boundary.
// @evidenceExclude contracts/performance.md#efficient-algorithms Projection owns computation, not this payload record.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This value coordinates no repeated computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Its enclosing dump owns storage lifetime.
type DumpDecoratorArgument struct {
  Literal any `json:"literal,omitempty"`
}

// DumpDecorator is a decorator as written on a declaration, carried on its
// target node for a consumer to interpret.
//
// @evidence contracts/common.md#principled-implementation The written name and ordered literal arguments preserve convention facts without selecting a framework meaning.
// @evidence contracts/common.md#clear-and-simple-design Target association is supplied by the enclosing node instead of repeated in this nested record.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No convention-specific expected endpoint is fabricated.
// @evidence contracts/common.md#meaningful-documentation Native prose explains written syntax and consumer interpretation, with documentation-skill tag spacing.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Decorator syntax data has no filesystem or process identity.
// @evidenceExclude contracts/performance.md#efficient-algorithms This nested payload does not choose collection or projection algorithms.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The producing generation owns shared fact reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The enclosing node payload owns these values' lifetime.
type DumpDecorator struct {
  Name      string                  `json:"name"`
  Arguments []DumpDecoratorArgument `json:"arguments"`
}

// DumpDocTag is one documentation tag TypeScript does not recognize, carried on
// the declaration it was written on. `name` is the tag without its `@` and
// `text` is everything after it, joined into one line. Neither is interpreted:
// which part of a text names a thing belongs to whichever convention wrote it.
//
// @evidence contracts/common.md#principled-implementation Name and normalized text preserve unknown-tag facts without assigning citation meaning to the text.
// @evidence contracts/common.md#clear-and-simple-design Node nesting supplies ownership while this record carries only the convention's written data.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No handpicked evidence or reference convention changes this general tag record.
// @evidence contracts/common.md#meaningful-documentation Native prose defines the absent @ prefix, joined text and uninterpreted semantics under the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Tag text is convention data, not a native path interpreted here.
// @evidenceExclude contracts/performance.md#efficient-algorithms This wire container selects no parsing algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The snapshot owns reused tag facts.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The record owns no acquisition or release lifecycle.
type DumpDocTag struct {
  Name string `json:"name"`
  Text string `json:"text,omitempty"`
}

// DumpEnumMember is one member of an enum on the wire: the name a caller writes
// and the value it carries. `value` is omitted for a member the checker could
// not fold to a constant — the name still stands, and the name is what a caller
// asking about the enum came for.
//
// @evidence contracts/common.md#principled-implementation Required Name preserves even the empty-string enum name; optional Value means the checker could not establish a constant value.
// @evidence contracts/common.md#clear-and-simple-design The ordered member record supplies enum outlines without additional graph identities.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No initializer text guessing or expected enum value is encoded.
// @evidence contracts/common.md#meaningful-documentation Native prose explains caller-visible name and optional constant value, with documentation-skill tag separation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Enum names and values carry no native boundary.
// @evidenceExclude contracts/performance.md#efficient-algorithms The record selects no folding or rendering algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Snapshot owners control fact reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The enclosing node owns storage lifetime.
type DumpEnumMember struct {
  Name  string `json:"name"`
  Value string `json:"value,omitempty"`
}

// DumpObjectMember is one direct object-literal member carried on its variable
// node. Line and Signature are rendered from the same Program-owned source text
// as the node evidence, so the outline cannot race a later disk write.
//
// @evidence contracts/common.md#principled-implementation Static member identity is separate from snapshot-rendered line/signature data that may be unavailable without source text.
// @evidence contracts/common.md#clear-and-simple-design A direct-member outline remains nested on its owning variable rather than duplicating declaration nodes.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No dynamic spread member or source-derived expected name is manufactured.
// @evidence contracts/common.md#meaningful-documentation Native prose explains direct membership and same-Program rendering, with tags separated under the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This source-syntax outline has no native filesystem identity.
// @evidenceExclude contracts/performance.md#efficient-algorithms Rendering and traversal belong to the dump context.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The container coordinates no computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Its parent node payload owns retention.
type DumpObjectMember struct {
  Name      string `json:"name"`
  Kind      string `json:"kind"`
  Line      int    `json:"line,omitempty"`
  Signature string `json:"signature,omitempty"`
}

// DumpNode is the wire shape of a graph node. Lowercase json keys are the
// contract; the Go field names are not.
//
// @evidence contracts/common.md#principled-implementation Required simple Name, optional qualified identity, source evidence and distinct artifact containment express the existing wire schema without inlining function bodies.
// @evidence contracts/common.md#clear-and-simple-design Display facts remain separate from identity and implementation evidence; the TypeScript loader owns synthesized declaration containment.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No MCP response cap, consumer fixture or guessed body boundary is represented as a graph fact.
// @evidence contracts/common.md#meaningful-documentation Native member comments explain signature boundaries, artifact-only Parent and lowercase JSON ownership, using documentation-skill spacing.
// @evidence contracts/portability.md#os-neutral-implementation File and span paths use the shared portable mapper while symbol names and artifact addresses keep their own protocol identity.
// @evidenceExclude contracts/performance.md#efficient-algorithms This wire container selects no projection algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The producing snapshot owns reuse of these facts.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The payload contains no independent handle or cache lifecycle.
type DumpNode struct {
  ID            string `json:"id"`
  Kind          string `json:"kind"`
  Name          string `json:"name"`
  QualifiedName string `json:"qualifiedName,omitempty"`

  // Signature is the declaration head, cut where the compiler says the body
  // opens. A consumer that reconstructed it by scanning physical lines both
  // leaked implementation text when a declaration shared its line with its body
  // and stopped early when the head itself contained a brace — a type-literal
  // parameter, an object return type, a destructured parameter. Neither is a
  // guess the consumer can win, so the producer renders it here.
  Signature string `json:"signature,omitempty"`

  File          string             `json:"file"`
  External      bool               `json:"external"`
  Ignored       bool               `json:"ignored,omitempty"`
  Exported      bool               `json:"exported,omitempty"`
  Closure       bool               `json:"closure,omitempty"`
  Modifiers     []string           `json:"modifiers,omitempty"`
  Literals      []string           `json:"literals,omitempty"`
  EnumMembers   []DumpEnumMember   `json:"enumMembers,omitempty"`
  ObjectMembers []DumpObjectMember `json:"objectMembers,omitempty"`

  // Parent is the artifact containing this one, and is empty for every
  // declaration: a declaration's containment is synthesized by the TypeScript
  // memory layer, and two producers of one relation would put two answers in
  // the graph.
  Parent string `json:"parent,omitempty"`

  Evidence       *DumpEvidence   `json:"evidence,omitempty"`
  Implementation *DumpEvidence   `json:"implementation,omitempty"`
  Decorators     []DumpDecorator `json:"decorators,omitempty"`
  DocTags        []DumpDocTag    `json:"docTags,omitempty"`
}

// DumpEdge is the wire shape of a graph edge. Lowercase json keys are the
// contract; the Go field names are not.
//
// @evidence contracts/common.md#principled-implementation Directed wire endpoints and refined relationship kind remain distinct from optional source evidence.
// @evidence contracts/common.md#clear-and-simple-design One relationship record carries only facts needed by the receiving graph loader.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No synthetic ranking relationship or expected path is encoded.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the wire shape and JSON-key contract, with documentation-skill tag separation.
// @evidence contracts/portability.md#os-neutral-implementation Endpoint IDs contain mapper-normalized path components and unchanged symbol names; this container performs no native case guessing.
// @evidenceExclude contracts/performance.md#efficient-algorithms Projection owns ordering and mapping algorithms.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The graph generation owns relationship reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The enclosing dump owns retained storage.
type DumpEdge struct {
  From     string        `json:"from"`
  To       string        `json:"to"`
  Kind     string        `json:"kind"`
  Evidence *DumpEvidence `json:"evidence,omitempty"`
}

// Dump is the IGraphDump envelope: the project it was built for, the evidence
// about the program that produced it, and the full node and edge sets with none
// of the MCP response caps.
//
// @evidence contracts/common.md#principled-implementation Facts, producer provenance and complete diagnostic collection describe one Program generation; empty arrays remain distinct from uncollected capabilities.
// @evidence contracts/common.md#clear-and-simple-design The envelope groups snapshot proof and uncapped facts without mixing serve-protocol controls into the body schema.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Complete facts are not replaced by sample nodes or MCP response limits.
// @evidence contracts/common.md#meaningful-documentation Native member paragraphs explain generation provenance and empty diagnostic semantics, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Project owns the physical base and every identity-bearing native path uses its portable coordinate vocabulary.
// @evidenceExclude contracts/performance.md#efficient-algorithms NewDump owns projection cost rather than this envelope type.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Session owners establish whether this snapshot may be reused.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns the completed payload's lifetime.
type Dump struct {
  Project  string `json:"project"`
  Tsconfig string `json:"tsconfig"`

  // Provenance proves the rest of this dump came from one Program. It rides the
  // body rather than the serve envelope so a dump written to a file by the
  // one-shot command keeps its evidence, and so a consumer holding only the
  // parsed dump never has to ask where it came from.
  Provenance Provenance `json:"provenance"`

  // Diagnostics are the compiler's findings for the same program generation
  // that produced Nodes and Edges. Empty means the program had none, not that
  // they were not collected; the producer states that in its capabilities.
  Diagnostics []Diagnostic `json:"diagnostics"`

  Nodes []DumpNode `json:"nodes"`
  Edges []DumpEdge `json:"edges"`
}

// DumpFacts is the path-normalized fact payload of one graph shard. It omits
// project-wide provenance and diagnostics so an incremental producer can
// project one invalidated closure without reconstructing a complete Dump.
//
// @evidence contracts/common.md#principled-implementation One shard's nodes and outgoing edges are separated from project-wide provenance and diagnostics that require a generation owner.
// @evidence contracts/common.md#clear-and-simple-design The smaller payload supports actual partial graph replacement without rebuilding a full envelope.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Shard scope comes from BuildFiles rather than arbitrary response caps or a fixture-specific subset.
// @evidence contracts/common.md#meaningful-documentation Native prose explains intentionally omitted project-wide fields and incremental responsibility, with documentation-skill tag spacing.
// @evidence contracts/portability.md#os-neutral-implementation Shard facts share the complete dump's portable path and evidence representation.
// @evidenceExclude contracts/performance.md#efficient-algorithms The projection operation chooses the algorithm, not this container.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The resident shard store owns unchanged-shard reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns retention and replacement of this payload.
type DumpFacts struct {
  Nodes []DumpNode `json:"nodes"`
  Edges []DumpEdge `json:"edges"`
}

// DumpOrigin is the snapshot evidence a caller attaches to a dump: who built it
// and what the same program generation had to say about the code. It is a
// separate struct because only the commands that own a compiler session can
// produce it, while the graph projection below is pure.
//
// @evidence contracts/common.md#principled-implementation Caller-captured producer evidence and diagnostics remain associated with the same compiler generation before pure dump projection.
// @evidence contracts/common.md#clear-and-simple-design The session boundary supplies origin facts explicitly instead of allowing the pure mapper to reread live compiler state.
// @evidence contracts/common.md#prohibited-implementation-shortcuts NewDump stamps the schema version; this input does not authorize guessed capabilities or reconstructed disk provenance.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes session acquisition from pure projection and explains nil diagnostics under the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Captured physical paths are deliberately retained until the shared dump mapper projects them together.
// @evidenceExclude contracts/performance.md#efficient-algorithms This input record chooses no snapshot acquisition algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The session owner establishes reuse validity.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The input container owns no independent retention or handle lifecycle.
type DumpOrigin struct {
  // Provenance identifies the producing program. NewDump always stamps the
  // schema version itself, so a caller cannot publish a wrong one.
  Provenance Provenance

  // Diagnostics are the compiler findings for the producing generation, or nil
  // when the caller did not collect them.
  Diagnostics []Diagnostic
}

// NewDump projects a built graph onto the export shape. project is the absolute
// root of the portable path coordinate; ignored is the git-ignored source set
// (nil for a non-git project); sources maps a source file's physical path to its
// text so byte spans become line/col evidence (nil omits evidence); origin is
// the snapshot evidence that proves where the facts came from. It returns an
// error before serialization when a path is on another filesystem root or two
// physical sources would collide at one wire identity.
//
// @evidence contracts/common.md#principled-implementation Facts, provenance and diagnostics pass through one mapper so the snapshot has injective portable identities and source spans from the supplied generation.
// @evidence contracts/common.md#clear-and-simple-design Shared newDumpFacts performs projection; this envelope adapter stamps producer schema and normalizes mandatory arrays before publication.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Collision and cross-root failures stop publication instead of emitting guessed coordinates or quietly dropping inconvenient nodes.
// @evidence contracts/common.md#meaningful-documentation Native prose states source ownership, project base, optional ignored set and pre-serialization failures, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Compiler virtual paths and native aliases use one mapper under the producing Program's preserved case policy; standalone graphs preserve exact spelling without OS syntax guesses.
// @evidence contracts/performance.md#efficient-algorithms Node/edge sorting is O(N log N + E log E); grouping facts and source line indexing are linear, with logarithmic indexed coordinate lookup per span.
// @evidence contracts/performance.md#reuse-equivalent-work One dump context shares raw path mapping, physical aliases and per-source line indices across facts, diagnostics and provenance for this immutable snapshot.
// @evidence contracts/performance.md#bound-retention-and-release-resources Mapping and line-index caches are call-local; only the completed output survives, and failed projections return no partial published payload.
func NewDump(g *Graph, project, tsconfig string, ignored map[string]bool, sources map[string]string, origin DumpOrigin) (Dump, error) {
  facts, ctx, err := newDumpFacts(g, project, ignored, sources)
  if err != nil {
    return Dump{}, err
  }

  // The schema version describes this code, not the caller's belief about it,
  // so stamp it here rather than trusting what came in.
  provenance := ctx.provenance(origin.Provenance)
  provenance.SchemaVersion = DumpSchemaVersion

  // A nil slice encodes as JSON null, and null is not an empty list: a reader
  // validating `string[]` rejects it, and a reader that does not would have to
  // guess which of the two the producer meant. Every list on the wire is a list.
  if provenance.Capabilities == nil {
    provenance.Capabilities = []string{}
  }
  if provenance.Sources == nil {
    provenance.Sources = []SourceDigest{}
  }
  if provenance.Universe.Configs == nil {
    provenance.Universe.Configs = []FileDigest{}
  }
  if provenance.Universe.Roots == nil {
    provenance.Universe.Roots = []RootFile{}
  }

  diagnostics := ctx.diagnostics(origin.Diagnostics)
  if diagnostics == nil {
    diagnostics = []Diagnostic{}
  }
  target := ctx.rel(tsconfig)
  if err := ctx.pathError(); err != nil {
    return Dump{}, err
  }

  return Dump{
    Project:     ctx.paths.project,
    Tsconfig:    target,
    Provenance:  provenance,
    Diagnostics: diagnostics,
    Nodes:       facts.Nodes,
    Edges:       facts.Edges,
  }, nil
}

// NewDumpFacts projects only one graph's nodes and edges through the complete
// dump path/evidence codec. The caller may pass a partial graph produced by
// BuildFiles; no project-wide provenance, diagnostic walk or full Dump is
// constructed.
//
// @evidence contracts/common.md#principled-implementation A partial graph uses the same identity and evidence codec as a full graph without pretending it carries project-wide origin facts.
// @evidence contracts/common.md#clear-and-simple-design One shared projection function supplies the actual shard payload rather than constructing and trimming a full Dump.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No response cap or guessed diagnostic omission changes shard fact identity.
// @evidence contracts/common.md#meaningful-documentation Native prose describes partial-build input and absent project-wide work, with documentation-skill tag spacing.
// @evidence contracts/portability.md#os-neutral-implementation Complete and partial graph builds retain their Program's case policy for shard coordinates, while the shared mapper rejects cross-root and identity-collision failures.
// @evidence contracts/performance.md#efficient-algorithms Processing follows this shard's node/edge/fact counts, sorting its output and indexing only source files needed by its spans.
// @evidence contracts/performance.md#reuse-equivalent-work The shard-local context shares path and line-index results among all emitted facts; unchanged shard reuse belongs to its resident caller.
// @evidence contracts/performance.md#bound-retention-and-release-resources Projection scratch dies after return; the caller owns the completed replacement payload and its retention.
func NewDumpFacts(g *Graph, project string, ignored map[string]bool, sources map[string]string) (DumpFacts, error) {
  facts, _, err := newDumpFacts(g, project, ignored, sources)
  return facts, err
}

func newDumpFacts(g *Graph, project string, ignored map[string]bool, sources map[string]string) (DumpFacts, *dumpContext, error) {
  ctx := newDumpContext(project, sources, !g.pathCaseInsensitive)

  // Decorators ride on their target node; group by the internal node id before
  // ids are relativized for output.
  decByNode := make(map[string][]DumpDecorator, len(g.Decorators))
  for _, d := range g.Decorators {
    args := make([]DumpDecoratorArgument, 0, len(d.Arguments))
    for _, a := range d.Arguments {
      if a.Literal == nil {
        continue
      }
      args = append(args, DumpDecoratorArgument{Literal: a.Literal})
    }
    decByNode[d.Target] = append(decByNode[d.Target], DumpDecorator{Name: d.Name, Arguments: args})
  }

  // Documentation tags ride on their target node the same way, grouped before
  // relativization for the same reason.
  tagsByNode := make(map[string][]DumpDocTag, len(g.DocTags))
  for _, t := range g.DocTags {
    tagsByNode[t.Target] = append(tagsByNode[t.Target], DumpDocTag{Name: t.Name, Text: t.Text})
  }

  nodes := make([]DumpNode, 0, len(g.Nodes))
  for _, n := range g.Nodes {
    name, qualified := nodeNames(n)
    // A module is named by its file, so its name relativizes like a path; every
    // other node is named by a symbol.
    if n.Kind == NodeModule {
      name, qualified = ctx.rel(name), ""
    }
    // An artifact's id IS the address a citation names, so it is emitted
    // verbatim: relativizing it would rewrite `prisma:Sale.price`, which carries
    // no path on purpose, and `POST:/orders`, which has no file at all. Its name
    // is the readable heading the plugin reported, and its span is the single
    // line where that heading starts — never the section's content.
    if IsArtifactKind(n.Kind) {
      artifact := DumpNode{
        ID:     n.ID,
        Kind:   string(n.Kind),
        Name:   n.Simple,
        File:   ctx.rel(n.File),
        Parent: n.ArtifactParent,
      }
      if artifact.Name == "" {
        artifact.Name = n.Name
      }
      if n.ArtifactLine > 0 {
        artifact.Evidence = &DumpEvidence{StartLine: n.ArtifactLine}
      }
      nodes = append(nodes, artifact)
      continue
    }
    nodes = append(nodes, DumpNode{
      ID:            ctx.relID(n.ID),
      Kind:          string(n.Kind),
      Name:          name,
      QualifiedName: qualified,
      File:          ctx.rel(n.File),
      External:      n.External,
      Ignored:       ignored[n.File],
      Exported:      n.Exported,
      Closure:       n.Closure,
      Modifiers:     n.Modifiers,
      // Uncapped, like every other fact here: the dump is the whole graph and
      // the MCP layer is what applies a response cap and marks it.
      Literals:       n.Literals,
      EnumMembers:    dumpEnumMembers(n.EnumMembers),
      ObjectMembers:  ctx.objectMembers(n),
      Signature:      ctx.declarationSignature(n),
      Evidence:       withoutFile(ctx.evidence(n.File, n.Pos, n.End)),
      Implementation: ctx.evidence(n.ImplementationFile, n.ImplementationPos, n.ImplementationEnd),
      Decorators:     decByNode[n.ID],
      DocTags:        tagsByNode[n.ID],
    })
  }
  sort.Slice(nodes, func(i, j int) bool { return nodes[i].ID < nodes[j].ID })

  edges := make([]DumpEdge, 0, len(g.Edges))
  for _, e := range g.Edges {
    includeEvidenceFile := e.File != "" && e.File != nodeFile(e.From)
    evidence := ctx.edgeEvidence(e, includeEvidenceFile)
    edges = append(edges, DumpEdge{
      From:     ctx.relID(e.From),
      To:       ctx.relID(e.To),
      Kind:     dumpEdgeKind(e),
      Evidence: evidence,
    })
  }
  sort.Slice(edges, func(i, j int) bool {
    if edges[i].From != edges[j].From {
      return edges[i].From < edges[j].From
    }
    if edges[i].To != edges[j].To {
      return edges[i].To < edges[j].To
    }
    return edges[i].Kind < edges[j].Kind
  })

  if err := ctx.pathError(); err != nil {
    return DumpFacts{}, ctx, err
  }
  return DumpFacts{Nodes: nodes, Edges: edges}, ctx, nil
}

// dumpEnumMembers projects an enum's members onto the wire shape, nil for a
// node that declares none so the key stays off every other kind.
func dumpEnumMembers(members []EnumMember) []DumpEnumMember {
  if len(members) == 0 {
    return nil
  }
  out := make([]DumpEnumMember, 0, len(members))
  for _, member := range members {
    out = append(out, DumpEnumMember{Name: member.Name, Value: member.Value})
  }
  return out
}

// objectMembers projects AST-owned object member identity and snapshot-owned
// display text. A missing source omits only line/signature; identity still came
// from the AST and therefore remains sound.
func (c *dumpContext) objectMembers(node *Node) []DumpObjectMember {
  if len(node.ObjectMembers) == 0 {
    return nil
  }
  out := make([]DumpObjectMember, 0, len(node.ObjectMembers))
  for _, member := range node.ObjectMembers {
    dumped := DumpObjectMember{
      Name: member.Name,
      Kind: objectMemberWireKind(member.Kind),
    }
    if evidence := c.evidence(node.File, member.Pos, member.End); evidence != nil {
      dumped.Line = evidence.StartLine
    }
    dumped.Signature = c.objectMemberSignature(node.File, member)
    out = append(out, dumped)
  }
  return out
}

func objectMemberWireKind(kind NodeKind) string {
  if kind == NodeMethod {
    return "method"
  }
  return "property"
}

// MarshalDump serializes a built graph to the export JSON, indented when pretty.
// See NewDump for the parameters.
//
// @evidence contracts/common.md#principled-implementation NewDump validates snapshot projection before standard JSON encoding, and formatting changes no graph facts.
// @evidence contracts/common.md#clear-and-simple-design One byte-returning adapter delegates graph semantics to NewDump and encoding to encoding/json.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Encoding failures propagate rather than substituting expected JSON or suppressing invalid paths.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies byte serialization and indentation; the referenced input contract remains documented by NewDump under the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation This adapter preserves NewDump's portable coordinate rules and propagates its native-boundary errors.
// @evidence contracts/performance.md#efficient-algorithms Projection has NewDump's sorting cost; JSON encoding is linear in output bytes and the requested byte slice necessarily holds that complete output.
// @evidence contracts/performance.md#reuse-equivalent-work Graph projection shares its per-snapshot indices; this adapter does not retain encoded results across changed generations.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned byte slice transfers to the caller and the function acquires no native resource or retained cache.
func MarshalDump(g *Graph, project, tsconfig string, ignored map[string]bool, sources map[string]string, origin DumpOrigin, pretty bool) ([]byte, error) {
  d, err := NewDump(g, project, tsconfig, ignored, sources, origin)
  if err != nil {
    return nil, err
  }
  if pretty {
    return json.MarshalIndent(d, "", "  ")
  }
  return json.Marshal(d)
}

// EncodeDump writes the export JSON straight to w, one buffered pass, ending it
// with the newline the one-shot protocol expects.
//
// The alternative, marshaling the whole document into a byte slice, converting
// that slice into a string and printing the string, holds a second full copy of
// the document live beside the first. On a large repository that is hundreds of
// megabytes of peak heap that buys nothing, because the bytes are already
// exactly what stdout wants.
//
// @evidence contracts/common.md#principled-implementation Validated projection is encoded directly to the supplied writer with the protocol's trailing newline and all writer failures preserved.
// @evidence contracts/common.md#clear-and-simple-design The streaming adapter keeps projection in NewDump and uses standard buffered JSON encoding rather than a second string-output pipeline.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Buffer size is an I/O batching constant, not a fact cap; no expected payload or foreign writer behavior is patched.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain direct output and avoided complete byte/string copies, with documentation-skill tag separation.
// @evidence contracts/portability.md#os-neutral-implementation The caller supplies the writer; portable graph identities and native mapping errors are preserved from NewDump without shell output quoting.
// @evidence contracts/performance.md#efficient-algorithms JSON work is linear in output bytes, with fixed buffering instead of complete encoded byte and string intermediates alongside the projected graph.
// @evidence contracts/performance.md#reuse-equivalent-work The projection context shares equivalent path and source-index work; streamed bytes are effectful output and are not replayed from a cross-request cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The function owns only its fixed local buffer and flushes on successful encoding; the supplied writer's close lifecycle belongs to its caller.
func EncodeDump(w io.Writer, g *Graph, project, tsconfig string, ignored map[string]bool, sources map[string]string, origin DumpOrigin, pretty bool) error {
  dump, err := NewDump(g, project, tsconfig, ignored, sources, origin)
  if err != nil {
    return err
  }
  buffered := bufio.NewWriterSize(w, 1<<20)
  encoder := json.NewEncoder(buffered)
  if pretty {
    encoder.SetIndent("", "  ")
  }
  if err := encoder.Encode(dump); err != nil {
    return err
  }
  return buffered.Flush()
}

// dumpEdgeKind maps an internal edge kind, refined by Edge.Origin, onto the
// schema's finer relationship kind.
func dumpEdgeKind(e *Edge) string {
  return wireEdgeKind(e.Kind, e.Origin)
}

// wireEdgeKind maps an internal edge kind, refined by its origin, onto the
// schema's finer relationship kind. It is the edge's emitted identity, so the
// dedup keys on it: two uses of one target that differ only in a form mapping to
// the same wire kind (a plain call and a tagged-template call, both `calls`)
// collapse to one edge, while forms that mean distinct relationships (`calls` vs
// `instantiates`, `extends` vs `implements`) are each kept.
func wireEdgeKind(kind EdgeKind, origin string) string {
  switch kind {
  case EdgeValueCall:
    switch origin {
    case "new":
      return "instantiates"
    case "jsx":
      return "renders"
    default:
      return "calls"
    }
  case EdgeValueAccess:
    return "accesses"
  case EdgeTypeRef:
    return "type_ref"
  case EdgeDocRef:
    return "doc_ref"
  case EdgeHeritage:
    if origin == "extends" {
      return "extends"
    }
    return "implements"
  case EdgeMemberRelation:
    return origin
  default:
    return string(kind)
  }
}

// nodeNames returns a node's simple name and, when it is owner-qualified, its
// full qualified form for the wire. The simple name is the symbol's own name
// recorded at build time, so a quoted member whose name contains a dot
// (`"a.b"` becomes Name `C.a.b`) splits exactly; the qualified form is the full Name
// when it differs from the simple name, and "" for a top-level declaration.
// A node without a recorded simple name (a future virtual node) falls back to
// the last dot-separated segment.
func nodeNames(n *Node) (simple, qualified string) {
  if n.Simple == "" && !n.HasSimple {
    if dot := strings.LastIndex(n.Name, "."); dot >= 0 {
      return n.Name[dot+1:], n.Name
    }
    return n.Name, ""
  }
  if n.Simple == n.Name {
    return n.Simple, ""
  }
  return n.Simple, n.Name
}

// dumpContext maps paths and turns byte spans into line/col evidence, caching a
// per-file line index so a large file's many edges cost O(log n) each instead
// of a re-scan.
type dumpContext struct {
  paths   *dumpPathMapper
  sources map[string]string
  lines   map[string]lineStarts
}

func newDumpContext(project string, sources map[string]string, caseSensitive ...bool) *dumpContext {
  return &dumpContext{
    paths:   newDumpPathMapper(project, caseSensitive...),
    sources: sources,
    lines:   map[string]lineStarts{},
  }
}

// rel delegates every identity-bearing path to the dump's one cached mapper.
func (c *dumpContext) rel(file string) string {
  return c.paths.mapPath(file)
}

func (c *dumpContext) pathError() error { return c.paths.err() }

// relID relativizes the path portion of a node id ("path#qualifiedName:kind").
// An id with no path (a future virtual node) is returned unchanged.
//
// A module is named by its own file path, so both halves of its id are paths and
// both relativize. Every other node is named by a symbol, which passes through
// untouched.
func (c *dumpContext) relID(id string) string {
  parts, ok := parseNodeID(id)
  if !ok {
    return id
  }
  name := parts.name
  if parts.kind == NodeModule {
    name = c.rel(name)
  }
  return nodeID(c.rel(parts.path), name, parts.kind)
}

// evidence builds the line/col span for a byte range in file, or nil when the
// span is absent or no source is available.
func (c *dumpContext) evidence(file string, pos, end int) *DumpEvidence {
  return c.evidenceWithFile(file, pos, end, true)
}

func (c *dumpContext) evidenceWithFile(file string, pos, end int, includeFile bool) *DumpEvidence {
  if pos < 0 || c.sources == nil {
    return nil
  }
  text, ok := c.sources[file]
  if !ok {
    return nil
  }
  ls := c.lines[file]
  if ls == nil {
    ls = newLineStarts(text)
    c.lines[file] = ls
  }
  if pos > len(text) {
    return nil
  }
  // Node.Pos() and an expression's Pos() are the full-start: they include the
  // leading whitespace and doc comments before the token. Advance to the first
  // code character so the line/column point at the declaration, not its banner
  // or its indentation.
  pos = FirstCodeOffset(text, pos)
  sl, sc := ls.at(pos)
  ev := &DumpEvidence{StartLine: sl, StartCol: sc}
  if includeFile {
    ev.File = c.rel(file)
  }
  if end > pos && end <= len(text) {
    ev.EndLine, ev.EndCol = ls.at(end)
  }
  return ev
}

// declarationSignature renders a declaration's head from the same
// Program-owned source text as its evidence, so the outline cannot race a later
// disk write. Empty when the producer could not bound the head, which leaves the
// consumer on its existing line scan rather than handing it a wrong cut.
func (c *dumpContext) declarationSignature(n *Node) string {
  if n == nil || n.SignatureEnd <= n.Pos || c.sources == nil {
    return ""
  }
  text, ok := c.sources[n.File]
  if !ok {
    return ""
  }
  pos := FirstCodeOffset(text, n.Pos)
  end := min(n.SignatureEnd, len(text))
  if pos >= end {
    return ""
  }
  return strings.TrimSpace(text[pos:end])
}

// objectMemberSignature reproduces the compact outline `details` returns, but
// slices it from Program-owned text while the dump is built
// instead of reopening the live file later.
func (c *dumpContext) objectMemberSignature(file string, member ObjectMember) string {
  pos, end := member.Pos, member.SignatureEnd
  if pos < 0 || end <= pos || c.sources == nil {
    return ""
  }
  text, ok := c.sources[file]
  if !ok || pos > len(text) {
    return ""
  }
  pos = FirstCodeOffset(text, pos)
  if end > len(text) {
    end = len(text)
  }
  if member.SignatureTokenLen > 0 {
    end = FirstCodeOffset(text, end)
    end = min(end+member.SignatureTokenLen, len(text))
  }
  if pos >= end {
    return ""
  }
  signature := strings.TrimSuffix(compactObjectMemberSignature(text[pos:end]), ",")
  const maxObjectMemberSignatureRunes = 160
  runes := []rune(signature)
  if len(runes) > maxObjectMemberSignatureRunes {
    signature = string(runes[:maxObjectMemberSignatureRunes-3]) + "..."
  }
  return signature
}

// compactObjectMemberSignature collapses trivia outside lexical values while
// leaving quoted strings, template literals, regular expressions, and comments
// byte-for-byte intact. A display outline may be compact, but changing literal
// whitespace would change the declaration it claims to quote.
func compactObjectMemberSignature(text string) string {
  var out strings.Builder
  pendingSpace := false
  for i := 0; i < len(text); {
    if width := sourceWhitespaceWidth(text, i); width > 0 {
      pendingSpace = out.Len() > 0
      i += width
      continue
    }
    if pendingSpace {
      out.WriteByte(' ')
      pendingSpace = false
    }

    end := i + 1
    switch text[i] {
    case '\'', '"':
      end = quotedSourceEnd(text, i, text[i])
    case '`':
      end = templateSourceEnd(text, i)
    case '/':
      switch {
      case i+1 < len(text) && text[i+1] == '/':
        end = LineCommentEnd(text, i)
      case i+1 < len(text) && text[i+1] == '*':
        end = blockCommentEnd(text, i)
      default:
        if candidate := regularExpressionEnd(text, i); candidate > i {
          end = candidate
        }
      }
    }
    out.WriteString(text[i:end])
    i = end
  }
  return strings.TrimSpace(out.String())
}

func quotedSourceEnd(text string, start int, quote byte) int {
  escaped := false
  for i := start + 1; i < len(text); i++ {
    if escaped {
      escaped = false
      continue
    }
    if text[i] == '\\' {
      escaped = true
      continue
    }
    if text[i] == quote {
      return i + 1
    }
  }
  return len(text)
}

// templateSourceEnd returns the last unescaped backtick in the member span.
// This deliberately treats substitutions and nested templates as one protected
// lexical region: preserving a little extra spacing is safer than compacting
// whitespace that belongs to either template's value.
func templateSourceEnd(text string, start int) int {
  end := len(text)
  for i := len(text) - 1; i > start; i-- {
    if text[i] == '`' && !sourceByteEscaped(text, i) {
      return i + 1
    }
  }
  return end
}

func sourceByteEscaped(text string, pos int) bool {
  slashes := 0
  for i := pos - 1; i >= 0 && text[i] == '\\'; i-- {
    slashes++
  }
  return slashes%2 == 1
}

func blockCommentEnd(text string, start int) int {
  if end := strings.Index(text[start+2:], "*/"); end >= 0 {
    return start + 2 + end + 2
  }
  return len(text)
}

// regularExpressionEnd conservatively protects a slash-delimited region when
// one closes on the same source line. Division can look the same without parser
// context; preserving its spaces is harmless, while compacting a real regular
// expression would change its pattern.
func regularExpressionEnd(text string, start int) int {
  escaped := false
  inClass := false
  for i := start + 1; i < len(text); i++ {
    switch {
    case lineTerminatorWidth(text, i) > 0:
      return start
    case escaped:
      escaped = false
    case text[i] == '\\':
      escaped = true
    case text[i] == '[':
      inClass = true
    case text[i] == ']':
      inClass = false
    case text[i] == '/' && !inClass:
      i++
      for i < len(text) && ((text[i] >= 'a' && text[i] <= 'z') || (text[i] >= 'A' && text[i] <= 'Z')) {
        i++
      }
      return i
    }
  }
  return start
}

// edgeEvidence is the evidence range for an edge's source expression.
func (c *dumpContext) edgeEvidence(e *Edge, includeFile bool) *DumpEvidence {
  file := e.File
  if file == "" {
    file = nodeFile(e.From)
  }
  if file == "" {
    return nil
  }
  return c.evidenceWithFile(file, e.Pos, e.End, includeFile)
}

// withoutFile drops a span file the reader reconstructs from the node or edge
// that carries the span. It never touches an implementation span.
func withoutFile(ev *DumpEvidence) *DumpEvidence {
  if ev == nil {
    return nil
  }
  ev.File = ""
  return ev
}

// lineStarts holds the byte offset of each line's start, so an offset maps to a
// 1-based line/column by binary search.
type lineStarts []int

func newLineStarts(text string) lineStarts {
  return lineStarts(ECMALineStarts(text))
}

// at returns the 1-based line and column of a byte offset.
func (ls lineStarts) at(offset int) (line, col int) {
  if offset < 0 || len(ls) == 0 {
    return 0, 0
  }
  i := sort.Search(len(ls), func(i int) bool { return ls[i] > offset }) - 1
  if i < 0 {
    i = 0
  }
  return i + 1, offset - ls[i] + 1
}
