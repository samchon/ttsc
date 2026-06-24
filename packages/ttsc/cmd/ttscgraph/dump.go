package main

import (
  "flag"
  "fmt"
  "strings"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// runDump builds the full code graph for a project and prints it as JSON to
// stdout, then exits. Unlike serve it does not stay resident: it is the one-shot
// `ttscgraph dump` a user pipes into a file to feed the 3D viewer or any other
// tooling. Every node and edge is included, with none of the MCP response caps.
// Returns 0 on success, 1 on a load or serialize error, 2 on invalid invocation.
func runDump(args []string) int {
  fs := flag.NewFlagSet("ttscgraph dump", flag.ContinueOnError)
  fs.SetOutput(stderr)
  cwdFlag := fs.String("cwd", "", "project root (defaults to process cwd)")
  tsconfigFlag := fs.String("tsconfig", "tsconfig.json", "project tsconfig path")
  prettyFlag := fs.Bool("pretty", false, "indent the JSON output")
  if err := fs.Parse(args); err != nil {
    return 2
  }

  cwd := strings.TrimSpace(*cwdFlag)
  if cwd == "" {
    resolved, err := getwd()
    if err != nil {
      fmt.Fprintf(stderr, "ttscgraph: could not resolve working directory: %v\n", err)
      return 2
    }
    cwd = resolved
  }
  tsconfig := strings.TrimSpace(*tsconfigFlag)

  prog, _, err := driver.LoadProgram(cwd, tsconfig, driver.LoadProgramOptions{})
  if err != nil {
    fmt.Fprintf(stderr, "ttscgraph: could not load %s/%s: %v\n", cwd, tsconfig, err)
    return 1
  }
  if prog == nil {
    fmt.Fprintf(stderr, "ttscgraph: could not load %s/%s\n", cwd, tsconfig)
    return 1
  }
  defer func() { _ = prog.Close() }()

  g := graph.Build(prog)
  ignored := graph.GitIgnoredFiles(cwd, g)
  data, err := graph.MarshalDump(g, cwd, tsconfig, ignored, *prettyFlag)
  if err != nil {
    fmt.Fprintf(stderr, "ttscgraph: %v\n", err)
    return 1
  }
  fmt.Fprintln(stdout, string(data))
  return 0
}
