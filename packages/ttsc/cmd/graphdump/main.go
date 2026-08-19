// Command graphdump builds the @ttsc/graph code graph for a project and prints
// the entire graph (every node and every edge, with none of the MCP response
// caps) as one JSON document. It is the repo-internal one-shot used by the
// benchmark graph viewer pipeline; the shipped equivalent is `ttscgraph dump`. Both
// serialize through graph.MarshalDump.
package main

import (
  "errors"
  "flag"
  "fmt"
  "io"
  "os"
  "path/filepath"

  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// Package-level streams so command tests can capture I/O without patching the
// os globals, and argv arrives as a parameter for the same reason. Both mirror
// the shipped sibling in cmd/ttscgraph, whose capability claim is tested the
// same way; this command's claim went undefended because it had neither seam.
var (
  stdout io.Writer = os.Stdout
  stderr io.Writer = os.Stderr
)

func main() {
  os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
  fs := flag.NewFlagSet("graphdump", flag.ContinueOnError)
  fs.SetOutput(stderr)
  cwd := fs.String("cwd", ".", "project root")
  tsconfig := fs.String("tsconfig", "tsconfig.json", "tsconfig path, relative to cwd")
  pretty := fs.Bool("pretty", false, "indent the JSON output")
  if err := fs.Parse(args); err != nil {
    // `-h` asks for the usage this just printed, so it is a request that
    // succeeded rather than an argument that failed. Under the global flag set
    // this command used to read, `ExitOnError` already exited 0 for it.
    if errors.Is(err, flag.ErrHelp) {
      return 0
    }
    return 2
  }

  // Resolve the project root the same way LoadProgram does (absolute, then
  // tsgo-normalized) so the dump path mapper receives the same canonical root
  // grammar and drive-letter case as the compiler's source paths.
  root := *cwd
  if abs, err := filepath.Abs(root); err == nil {
    root = abs
  }
  root = shimtspath.ResolvePath(root)

  prog, _, err := driver.LoadProgram(root, *tsconfig, driver.LoadProgramOptions{})
  if err != nil {
    fmt.Fprintf(stderr, "graphdump: could not load %s/%s: %v\n", root, *tsconfig, err)
    return 1
  }
  if prog == nil {
    fmt.Fprintf(stderr, "graphdump: could not load %s/%s\n", root, *tsconfig)
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
      // The declaration walk is the shipped one, so this dump carries every
      // documentation tag and must say so: under the capability contract an
      // absent claim means the producer never looked, which would make a
      // consumer read a tagged declaration as citing nothing.
      []string{graph.CapabilitySourceDigests, graph.CapabilityDocTags},
      nil,
      nil,
      texts,
      nil,
    ),
  }, *pretty)
  if err != nil {
    fmt.Fprintf(stderr, "graphdump: %v\n", err)
    return 1
  }
  fmt.Fprintln(stdout, string(data))
  return 0
}
