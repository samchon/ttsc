// Command graphdump builds the @ttsc/graph code graph for a project and prints
// the entire graph (every node and every edge, with none of the MCP response
// caps) as one JSON document. It is the repo-internal one-shot used by the
// benchmark viewer pipeline; the shipped equivalent is `ttscgraph dump`. Both
// serialize through graph.MarshalDump.
package main

import (
  "flag"
  "fmt"
  "os"
  "path/filepath"

  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

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

  // Resolve the project root the same way LoadProgram does (absolute, then
  // tsgo-normalized) so it shares the node file paths' drive-letter case on
  // Windows; otherwise the dump's prefix-based relativization would miss and
  // leave every path absolute.
  root := *cwd
  if abs, err := filepath.Abs(root); err == nil {
    root = abs
  }
  root = shimtspath.ResolvePath(root)

  prog, _, err := driver.LoadProgram(root, *tsconfig, driver.LoadProgramOptions{})
  if err != nil {
    fmt.Fprintf(os.Stderr, "graphdump: could not load %s/%s: %v\n", root, *tsconfig, err)
    return 1
  }
  if prog == nil {
    fmt.Fprintf(os.Stderr, "graphdump: could not load %s/%s\n", root, *tsconfig)
    return 1
  }
  defer func() { _ = prog.Close() }()

  g := graph.Build(prog)
  ignored := graph.GitIgnoredFiles(root, g)
  data, err := graph.MarshalDump(g, root, *tsconfig, ignored, graph.SourceTexts(prog), *pretty)
  if err != nil {
    fmt.Fprintf(os.Stderr, "graphdump: %v\n", err)
    return 1
  }
  fmt.Println(string(data))
  return 0
}
