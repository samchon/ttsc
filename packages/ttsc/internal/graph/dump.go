package graph

import "encoding/json"

// The Go Node/Edge structs carry no json tags (their fields are not a wire
// contract). DumpNode/DumpEdge are the explicit JSON shape of a full-graph
// export: lowercase keys, nodes as a flat array (the id is carried inside), the
// whole graph with none of the MCP response caps. It is what `ttscgraph dump`
// prints and what the 3D web viewer reduces and renders.

type DumpNode struct {
  ID       string `json:"id"`
  Name     string `json:"name"`
  Kind     string `json:"kind"`
  File     string `json:"file"`
  External bool   `json:"external"`
  // Ignored marks a node whose file git ignores (generated code like a Prisma
  // client emitted as .ts). The viewer drops these by default so generated
  // output does not bury the authored graph; see graph.GitIgnoredFiles.
  Ignored bool `json:"ignored"`
  Pos     int  `json:"pos"`
  End     int  `json:"end"`
}

type DumpEdge struct {
  From string `json:"from"`
  To   string `json:"to"`
  Kind string `json:"kind"`
}

type Dump struct {
  SchemaVersion int        `json:"schemaVersion"`
  Project       string     `json:"project"`
  Tsconfig      string     `json:"tsconfig"`
  Provenance    string     `json:"provenance"`
  Nodes         []DumpNode `json:"nodes"`
  Edges         []DumpEdge `json:"edges"`
}

// NewDump projects a built graph onto the export shape. Paths are left absolute
// (the viewer relativizes them); this stays a faithful serialization. ignored is
// the set of git-ignored source files from graph.GitIgnoredFiles (nil for a
// non-git project); their nodes are tagged so the viewer can drop them.
func NewDump(g *Graph, project, tsconfig string, ignored map[string]bool) Dump {
  d := Dump{
    SchemaVersion: 1,
    Project:       project,
    Tsconfig:      tsconfig,
    Provenance:    Provenance,
    Nodes:         make([]DumpNode, 0, len(g.Nodes)),
    Edges:         make([]DumpEdge, 0, len(g.Edges)),
  }
  for _, n := range g.Nodes {
    d.Nodes = append(d.Nodes, DumpNode{
      ID:       n.ID,
      Name:     n.Name,
      Kind:     string(n.Kind),
      File:     n.File,
      External: n.External,
      Ignored:  ignored[n.File],
      Pos:      n.Pos,
      End:      n.End,
    })
  }
  for _, e := range g.Edges {
    d.Edges = append(d.Edges, DumpEdge{
      From: e.From,
      To:   e.To,
      Kind: string(e.Kind),
    })
  }
  return d
}

// MarshalDump serializes a built graph to the export JSON, indented when pretty.
// ignored is the git-ignored file set (see NewDump).
func MarshalDump(g *Graph, project, tsconfig string, ignored map[string]bool, pretty bool) ([]byte, error) {
  d := NewDump(g, project, tsconfig, ignored)
  if pretty {
    return json.MarshalIndent(d, "", "  ")
  }
  return json.Marshal(d)
}
