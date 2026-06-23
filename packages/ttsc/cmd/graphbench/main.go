// Command graphbench measures @ttsc/graph against a real project: how long the
// resident Program takes to load, how long graph extraction takes on top of that
// already-built Program, how many nodes and edges result, and the codegraph-style
// "fair coverage" (share of symbol-bearing source files with at least one
// resolved cross-file edge). It prints one JSON line so an orchestrator can run
// it N times and take medians.
//
// Counts and coverage are deterministic; timings are indicative and only
// meaningful on a quiet host (see .codex/skills/benchmark).
package main

import (
  "encoding/json"
  "flag"
  "fmt"
  "os"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

type metrics struct {
  Project       string         `json:"project"`
  LoadMs        float64        `json:"loadMs"`
  BuildMs       float64        `json:"buildMs"`
  BuildShare    float64        `json:"buildShareOfLoad"`
  SourceFiles   int            `json:"sourceFiles"`
  Nodes         int            `json:"nodes"`
  ExternalNodes int            `json:"externalNodes"`
  Edges         map[string]int `json:"edges"`
  TotalEdges    int            `json:"totalEdges"`
  SymbolFiles   int            `json:"symbolFiles"`
  CoveredFiles  int            `json:"coveredFiles"`
  Coverage      float64        `json:"coverage"`
}

func main() {
  os.Exit(run())
}

func run() int {
  cwd := flag.String("cwd", ".", "project root")
  tsconfig := flag.String("tsconfig", "tsconfig.json", "tsconfig path, relative to cwd")
  flag.Parse()

  loadStart := time.Now()
  prog, _, err := driver.LoadProgram(*cwd, *tsconfig, driver.LoadProgramOptions{})
  loadMs := time.Since(loadStart).Seconds() * 1000
  if err != nil {
    fmt.Fprintf(os.Stderr, "graphbench: could not load %s/%s: %v\n", *cwd, *tsconfig, err)
    return 1
  }
  if prog == nil {
    fmt.Fprintf(os.Stderr, "graphbench: could not load %s/%s\n", *cwd, *tsconfig)
    return 1
  }
  defer func() { _ = prog.Close() }()

  buildStart := time.Now()
  g := graph.Build(prog)
  buildMs := time.Since(buildStart).Seconds() * 1000

  m := summarize(g, len(prog.SourceFiles()))
  m.Project = *cwd
  m.LoadMs = loadMs
  m.BuildMs = buildMs
  if loadMs > 0 {
    m.BuildShare = buildMs / loadMs
  }

  out, err := json.Marshal(m)
  if err != nil {
    fmt.Fprintf(os.Stderr, "graphbench: %v\n", err)
    return 1
  }
  fmt.Println(string(out))
  return 0
}

// summarize reduces a built graph to the reported metrics: node and external
// counts, edges per kind, and fair coverage (workspace files holding at least one
// node that an edge connects to a node in another file).
func summarize(g *graph.Graph, sourceFiles int) metrics {
  edges := map[string]int{
    string(graph.EdgeHeritage):  0,
    string(graph.EdgeValueCall): 0,
    string(graph.EdgeTypeRef):   0,
  }
  for _, edge := range g.Edges {
    edges[string(edge.Kind)]++
  }

  fileOf := make(map[string]string, len(g.Nodes))
  symbolFiles := map[string]bool{}
  external := 0
  for id, node := range g.Nodes {
    fileOf[id] = node.File
    if node.External {
      external++
      continue
    }
    symbolFiles[node.File] = true
  }

  coveredFiles := map[string]bool{}
  for _, edge := range g.Edges {
    from, to := fileOf[edge.From], fileOf[edge.To]
    if from == "" || to == "" || from == to {
      continue
    }
    if symbolFiles[from] {
      coveredFiles[from] = true
    }
    if symbolFiles[to] {
      coveredFiles[to] = true
    }
  }

  coverage := 0.0
  if len(symbolFiles) > 0 {
    coverage = float64(len(coveredFiles)) / float64(len(symbolFiles))
  }

  return metrics{
    SourceFiles:   sourceFiles,
    Nodes:         len(g.Nodes),
    ExternalNodes: external,
    Edges:         edges,
    TotalEdges:    len(g.Edges),
    SymbolFiles:   len(symbolFiles),
    CoveredFiles:  len(coveredFiles),
    Coverage:      coverage,
  }
}
