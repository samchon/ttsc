// Command ttscgraph builds the checker-resolved code graph for a project. The
// one-shot `dump` command prints JSON; the internal `serve` command keeps an
// incremental compiler session resident for @ttsc/graph. MCP tools and schemas
// remain in the TypeScript package.
package main

import (
  "fmt"
  "io"
  "os"
  "runtime"
  "strings"
)

// Build metadata; overwritten via -ldflags in release builds.
var (
  version = "0.0.0-dev"
  commit  = "dev"
  date    = "unknown"
)

// Package-level streams so command tests can capture I/O without patching the
// os globals.
var (
  stdout io.Writer = os.Stdout
  stderr io.Writer = os.Stderr
)

// getwd is the seam command tests use to simulate a working-directory failure.
var getwd = os.Getwd

func main() {
  os.Exit(run(os.Args[1:]))
}

// run dispatches the top-level command and returns an exit code. Anything that
// is not help, version, dump, or the internal serve protocol prints usage and
// exits 2; serving MCP itself remains the launcher's job.
func run(args []string) int {
  if len(args) > 0 {
    switch args[0] {
    case "-h", "--help", "help":
      printHelp(stdout)
      return 0
    case "-v", "--version", "version":
      printVersion(stdout)
      return 0
    case "dump":
      return runDump(args[1:])
    case "serve":
      return runServe(args[1:])
    }
  }
  printHelp(stderr)
  return 2
}

func printVersion(w io.Writer) {
  fmt.Fprintf(
    w,
    "ttscgraph %s (commit %s, built %s, %s/%s, go %s)\n",
    version,
    commit,
    date,
    runtime.GOOS,
    runtime.GOARCH,
    runtime.Version(),
  )
}

func printHelp(w io.Writer) {
  fmt.Fprintln(w, strings.TrimSpace(`
ttscgraph — checker-resolved code graph for ttsc.

Builds the project's code graph as JSON or keeps an incremental compiler session
for the @ttsc/graph launcher. The MCP tools live in @ttsc/graph, not here.

Usage:
  ttscgraph dump [--cwd <dir>] [--tsconfig <path>] [--pretty] > graph.json
  ttscgraph serve [--cwd <dir>] [--tsconfig <path>]
  ttscgraph --version
  ttscgraph --help

Dump:
  dump                 Build the whole graph and print it as JSON to stdout, then
                       exit. Every node and edge, none of the MCP response caps.
  --cwd <dir>          Project root (defaults to the process working directory).
  --tsconfig <path>    Project tsconfig path (default: tsconfig.json).
  --pretty             Indent the JSON output.

Serve:
  serve                Internal newline-delimited snapshot protocol used by
                       @ttsc/graph. Keeps the compiler Program resident, applies
                       source edits incrementally, and reloads on structural
                       project changes.
`))
}
