// Command graphdump builds the @ttsc/graph code graph for a project and prints
// the entire graph (every node and every edge, with none of the MCP response
// caps) as one JSON document. It is the repo-internal one-shot used by the
// benchmark graph viewer pipeline; the shipped equivalent is `ttscgraph dump`. Both
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
  // tsgo-normalized) so the schema-v6 mapper receives the same canonical root
  // grammar and drive-letter case as the compiler's source paths.
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
  texts := graph.SourceTexts(prog)
  // The viewer pipeline reduces nodes and edges and never asks whether the build
  // universe moved or whether the disk still matches, so this tool pays for
  // neither. It names its producer and digests what the checker read, and it
  // declares exactly that and no more: a reader learns the universe and the disk
  // digests are absent, rather than reading an empty universe as "nothing
  // changed" or an empty diskDigest as "the file could not be read". The shipped
  // `ttscgraph dump` is the one that proves the whole contract.
  data, err := graph.MarshalDump(g, root, *tsconfig, ignored, texts, graph.DumpOrigin{
    Provenance: graph.NewProvenance(
      // No version: this tool is built from the tree on demand and never
      // stamped, and an invented one would be worse than an absent one.
      graph.Producer{Tool: "graphdump", Typescript: graph.TypescriptVersion()},
      []string{graph.CapabilitySourceDigests},
      nil,
      nil,
      texts,
      nil,
    ),
  }, *pretty)
  if err != nil {
    fmt.Fprintf(os.Stderr, "graphdump: %v\n", err)
    return 1
  }
  fmt.Println(string(data))
  return 0
}
