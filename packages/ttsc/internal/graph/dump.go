package graph

import (
  "encoding/json"
  "path/filepath"
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
//     "renders", and EdgeHeritage into "extends" / "implements";
//   - every edge is tagged checker-resolved / high (the graph's whole contract);
//   - byte spans become 1-based line/col Evidence ranges;
//   - decorator facts ride on their target node;
//   - file paths are project-relative and the output is sorted, so the dump is
//     deterministic and diffable.
//
// Structural derivations the schema also defines (file nodes, contains/exports
// edges) are left to the TypeScript loader, which has the node set in hand and
// is where the redesign keeps that logic.

// DumpEvidence is a 1-based source span grounding a node declaration or an edge
// expression. It is display/expansion only, never identity.
type DumpEvidence struct {
  File      string `json:"file"`
  StartLine int    `json:"startLine"`
  StartCol  int    `json:"startCol,omitempty"`
  EndLine   int    `json:"endLine,omitempty"`
  EndCol    int    `json:"endCol,omitempty"`
}

// DumpDecoratorArgument is one decorator argument; Literal is set only for a
// statically-resolved string or boolean literal.
type DumpDecoratorArgument struct {
  Literal any `json:"literal,omitempty"`
}

// DumpDecorator is a decorator as written on a declaration, carried on its
// target node for a consumer to interpret.
type DumpDecorator struct {
  Name      string                  `json:"name"`
  Arguments []DumpDecoratorArgument `json:"arguments"`
}

// DumpNode is the wire shape of a graph node. Lowercase json keys are the
// contract; the Go field names are not.
type DumpNode struct {
  ID             string          `json:"id"`
  Kind           string          `json:"kind"`
  Name           string          `json:"name"`
  QualifiedName  string          `json:"qualifiedName,omitempty"`
  File           string          `json:"file"`
  External       bool            `json:"external"`
  Ignored        bool            `json:"ignored,omitempty"`
  Exported       bool            `json:"exported,omitempty"`
  Modifiers      []string        `json:"modifiers,omitempty"`
  Evidence       *DumpEvidence   `json:"evidence,omitempty"`
  Implementation *DumpEvidence   `json:"implementation,omitempty"`
  Decorators     []DumpDecorator `json:"decorators,omitempty"`
}

// DumpEdge is the wire shape of a graph edge. Lowercase json keys are the
// contract; the Go field names are not.
type DumpEdge struct {
  From     string        `json:"from"`
  To       string        `json:"to"`
  Kind     string        `json:"kind"`
  Evidence *DumpEvidence `json:"evidence,omitempty"`
}

// Dump is the IGraphDump envelope: the project it was built for and the full
// node and edge sets with none of the MCP response caps.
type Dump struct {
  Project  string     `json:"project"`
  Tsconfig string     `json:"tsconfig"`
  Nodes    []DumpNode `json:"nodes"`
  Edges    []DumpEdge `json:"edges"`
}

// NewDump projects a built graph onto the export shape. project is the absolute
// project root used to relativize file paths and node ids; ignored is the
// git-ignored source set (nil for a non-git project); sources maps a source
// file's path to its text so byte spans become line/col evidence (nil omits
// evidence).
func NewDump(g *Graph, project, tsconfig string, ignored map[string]bool, sources map[string]string) Dump {
  ctx := newDumpContext(project, sources)

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

  nodes := make([]DumpNode, 0, len(g.Nodes))
  for _, n := range g.Nodes {
    name, qualified := nodeNames(n)
    nodes = append(nodes, DumpNode{
      ID:             ctx.relID(n.ID),
      Kind:           string(n.Kind),
      Name:           name,
      QualifiedName:  qualified,
      File:           ctx.rel(n.File),
      External:       n.External,
      Ignored:        ignored[n.File],
      Exported:       n.Exported,
      Modifiers:      n.Modifiers,
      Evidence:       ctx.evidence(n.File, n.Pos, n.End),
      Implementation: ctx.evidence(n.ImplementationFile, n.ImplementationPos, n.ImplementationEnd),
      Decorators:     decByNode[n.ID],
    })
  }
  sort.Slice(nodes, func(i, j int) bool { return nodes[i].ID < nodes[j].ID })

  edges := make([]DumpEdge, 0, len(g.Edges))
  for _, e := range g.Edges {
    edges = append(edges, DumpEdge{
      From:     ctx.relID(e.From),
      To:       ctx.relID(e.To),
      Kind:     dumpEdgeKind(e),
      Evidence: ctx.edgeEvidence(e),
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

  return Dump{
    Project:  project,
    Tsconfig: tsconfig,
    Nodes:    nodes,
    Edges:    edges,
  }
}

// MarshalDump serializes a built graph to the export JSON, indented when pretty.
// See NewDump for the parameters.
func MarshalDump(g *Graph, project, tsconfig string, ignored map[string]bool, sources map[string]string, pretty bool) ([]byte, error) {
  d := NewDump(g, project, tsconfig, ignored, sources)
  if pretty {
    return json.MarshalIndent(d, "", "  ")
  }
  return json.Marshal(d)
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
  case EdgeHeritage:
    if origin == "extends" {
      return "extends"
    }
    return "implements"
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
  if n.Simple == "" {
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

// dumpContext relativizes paths and turns byte spans into line/col evidence,
// caching a per-file line index so a large file's many edges cost O(log n) each
// instead of a re-scan.
type dumpContext struct {
  project string
  sources map[string]string
  lines   map[string]lineStarts
}

func newDumpContext(project string, sources map[string]string) *dumpContext {
  return &dumpContext{
    project: strings.TrimRight(filepath.ToSlash(project), "/"),
    sources: sources,
    lines:   map[string]lineStarts{},
  }
}

// rel makes a source file path project-relative; an external path keeps its
// node_modules-relative tail so a dependency leaf stays readable.
func (c *dumpContext) rel(file string) string {
  f := filepath.ToSlash(file)
  if c.project != "" {
    if f == c.project {
      return ""
    }
    if strings.HasPrefix(f, c.project+"/") {
      return f[len(c.project)+1:]
    }
  }
  if i := strings.LastIndex(f, "/node_modules/"); i >= 0 {
    return f[i+1:]
  }
  return f
}

// relID relativizes the path portion of a node id ("path#qualifiedName:kind").
// An id with no path (a future virtual node) is returned unchanged.
func (c *dumpContext) relID(id string) string {
  hash := strings.Index(id, "#")
  if hash < 0 {
    return id
  }
  return c.rel(id[:hash]) + id[hash:]
}

// evidence builds the line/col span for a byte range in file, or nil when the
// span is absent or no source is available.
func (c *dumpContext) evidence(file string, pos, end int) *DumpEvidence {
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
  pos = firstCodeOffset(text, pos)
  sl, sc := ls.at(pos)
  ev := &DumpEvidence{File: c.rel(file), StartLine: sl, StartCol: sc}
  if end > pos && end <= len(text) {
    ev.EndLine, ev.EndCol = ls.at(end)
  }
  return ev
}

// firstCodeOffset advances past leading trivia: whitespace, // line comments,
// and /* */ block comments from pos to the first code byte, or len(text) if
// the rest is all trivia. It mirrors how a token's real start is found, so an
// evidence span lands on the declaration rather than the comment above it.
func firstCodeOffset(text string, pos int) int {
  i := pos
  for i < len(text) {
    switch {
    case text[i] == ' ' || text[i] == '\t' || text[i] == '\r' || text[i] == '\n':
      i++
    case text[i] == '/' && i+1 < len(text) && text[i+1] == '/':
      i += 2
      for i < len(text) && text[i] != '\n' {
        i++
      }
    case text[i] == '/' && i+1 < len(text) && text[i+1] == '*':
      i += 2
      for i+1 < len(text) && !(text[i] == '*' && text[i+1] == '/') {
        i++
      }
      if i+1 < len(text) {
        i += 2
      } else {
        i = len(text)
      }
    default:
      return i
    }
  }
  return i
}

// edgeEvidence is the evidence range for an edge's source expression.
func (c *dumpContext) edgeEvidence(e *Edge) *DumpEvidence {
  // The edge's span lives in the From node's file.
  file := nodeFile(e.From)
  if file == "" {
    return nil
  }
  return c.evidence(file, e.Pos, e.End)
}

// nodeFile recovers the source file path embedded in a node id
// ("path#qualifiedName:kind"); "" for an id without a path.
func nodeFile(id string) string {
  if hash := strings.Index(id, "#"); hash >= 0 {
    return id[:hash]
  }
  return ""
}

// lineStarts holds the byte offset of each line's start, so an offset maps to a
// 1-based line/column by binary search.
type lineStarts []int

func newLineStarts(text string) lineStarts {
  starts := make(lineStarts, 1, 1+strings.Count(text, "\n"))
  starts[0] = 0
  for i := 0; i < len(text); i++ {
    if text[i] == '\n' {
      starts = append(starts, i+1)
    }
  }
  return starts
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
