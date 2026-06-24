// Command graphdump builds the @ttsc/graph code graph for a project and prints
// the entire graph (every node and every edge, with none of the MCP response
// caps) as one JSON document. It is the repo-internal one-shot used by the
// graph-bench viewer pipeline; the shipped equivalent is `ttscgraph dump`. Both
// serialize through graph.MarshalDump.
package main

import (
  "flag"
  "fmt"
  "os"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

func main() {
  os.Exit(run())
}

func run() int {
  cwd := flag.String("cwd", ".", "project root")
  tsconfig := flag.String("tsconfig", "tsconfig.json", "tsconfig path, relative to cwd")
  pretty := flag.Bool("pretty", false, "indent the JSON output")
  flag.Parse()

  prog, _, err := driver.LoadProgram(*cwd, *tsconfig, driver.LoadProgramOptions{})
  if err != nil {
    fmt.Fprintf(os.Stderr, "graphdump: could not load %s/%s: %v\n", *cwd, *tsconfig, err)
    return 1
  }
  if prog == nil {
    fmt.Fprintf(os.Stderr, "graphdump: could not load %s/%s\n", *cwd, *tsconfig)
    return 1
  }
  defer func() { _ = prog.Close() }()

  g := graph.Build(prog)
  ignored := graph.GitIgnoredFiles(*cwd, g)
  data, err := graph.MarshalDump(g, *cwd, *tsconfig, ignored, *pretty)
  if err != nil {
    fmt.Fprintf(os.Stderr, "graphdump: %v\n", err)
    return 1
  }
  fmt.Println(string(data))
  return 0
}
