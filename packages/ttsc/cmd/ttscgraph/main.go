// Command ttscgraph serves a checker-resolved code graph and diagnostics to
// coding agents over the Model Context Protocol (JSON-RPC 2.0 on stdio). It
// builds one resident tsgo Program for the project and answers every tool call
// from that warm handle, so a query is a method call on an already-built checker
// rather than a fresh compile or an external language-server round-trip.
//
// The JavaScript launcher (@ttsc/graph) resolves the per-platform native binary
// and spawns `ttscgraph --stdio`; an agent's MCP client drives it over stdio.
// Everything here is deliberately small: flag parsing, version metadata, and a
// single delegation to the resident MCP server.
package main

import (
  "flag"
  "fmt"
  "io"
  "os"
  "runtime"
  "strings"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
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
  stdin  io.Reader = os.Stdin
)

// getwd is the seam command tests use to simulate a working-directory failure.
var getwd = os.Getwd

func main() {
  os.Exit(run(os.Args[1:]))
}

// run dispatches top-level flags and returns an exit code. Called by main with
// os.Args[1:] and overridden in tests with a synthetic argument slice.
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
    }
  }
  return runServe(args)
}

// runServe parses serve flags, loads the resident program, and serves MCP over
// stdio. It returns 0 on a clean EOF shutdown, 1 on a load or runtime error, and
// 2 on invalid invocation.
func runServe(args []string) int {
  fs := flag.NewFlagSet("ttscgraph", flag.ContinueOnError)
  fs.SetOutput(stderr)
  _ = fs.Bool("stdio", true, "serve MCP over stdin/stdout")
  cwdFlag := fs.String("cwd", "", "project root (defaults to process cwd)")
  tsconfigFlag := fs.String("tsconfig", "tsconfig.json", "project tsconfig path")
  connectFlag := fs.String("connect", "", "proxy mode: pipe stdio to a running daemon at host:port")
  daemonFlag := fs.Bool("daemon", false, "daemon mode: build once and serve many connections over a localhost port")
  portFileFlag := fs.String("port-file", "", "daemon mode: write the chosen host:port here")
  idleFlag := fs.Duration("idle", 5*time.Minute, "daemon mode: exit after this long with no connections (0 disables)")
  if err := fs.Parse(args); err != nil {
    return 2
  }

  if addr := strings.TrimSpace(*connectFlag); addr != "" {
    return runConnect(addr)
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
  mcp.Version = version

  if *daemonFlag {
    return runDaemon(cwd, tsconfig, strings.TrimSpace(*portFileFlag), *idleFlag)
  }

  // Default: single-process. NewLazyServer answers the MCP handshake immediately
  // and type-checks the project in the background, so an agent sees the tools
  // without waiting on the load and never hits the cold-start race. The first
  // tool call blocks until the build lands.
  server := mcp.NewLazyServer(cwd, tsconfig, driver.LoadProgramOptions{}, injectedDiagnosticProviders()...)
  if err := server.Serve(stdin, stdout); err != nil {
    fmt.Fprintf(stderr, "ttscgraph: %v\n", err)
    return 1
  }
  return 0
}

// injectedDiagnosticProviders returns the diagnostic providers configured by the
// environment. The @ttsc/graph launcher, after evaluating the project's
// lint.config and running ttsc's plugin-aware check, sets
// TTSC_GRAPH_DIAGNOSTICS_FILE to a JSON file of the project's @ttsc/lint and
// transform-plugin findings, which the graph fuses onto its nodes. Unset — a
// project without plugins, or a bare invocation — means tsc-only diagnostics.
func injectedDiagnosticProviders() []mcp.DiagnosticProvider {
  path := strings.TrimSpace(os.Getenv("TTSC_GRAPH_DIAGNOSTICS_FILE"))
  if path == "" {
    return nil
  }
  return []mcp.DiagnosticProvider{mcp.InjectedDiagnosticsProvider(path)}
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
ttscgraph — checker-resolved code graph + diagnostics over MCP for ttsc.

Usage:
  ttscgraph --stdio
  ttscgraph dump [--tsconfig <path>] > graph.json
  ttscgraph --version
  ttscgraph --help

Options:
  --stdio              Serve MCP over stdin/stdout (the default transport).
  --cwd <dir>          Project root (defaults to the process working directory).
  --tsconfig <path>    Project tsconfig path (default: tsconfig.json).

Dump (one-shot, no server):
  dump                 Build the whole graph and print it as JSON to stdout, then
                       exit. Every node and edge, none of the MCP response caps.
                       Pipe it into a file to feed the 3D viewer or other tooling:
                       ttscgraph dump --tsconfig tsconfig.json > graph.json
  --pretty             dump: indent the JSON output.

Large-repository daemon (advanced):
  --daemon               Build the Program once and serve many connections over a
                         loopback (127.0.0.1) port, so a multi-minute type-check
                         is not repeated per session.
  --connect <host:port>  Proxy this process's stdio to a running daemon.
  --port-file <path>     Daemon: write the chosen host:port here (mode 0600).
  --idle <dur>           Daemon: exit after this idle period (default 5m; 0 off).

  Security: the daemon's loopback port is UNAUTHENTICATED. Any process on the
  machine that connects can read this project's source through the graph, so run
  it only on a single-user host. The @ttsc/graph launcher never starts the
  daemon; stdio is the default.

Typical embedding:
  An agent's MCP client spawns ttscgraph through the @ttsc/graph launcher, which
  resolves the per-platform native binary. ttscgraph builds one resident tsgo
  Program for the project and answers graph_explore / graph_diagnostics calls
  from that warm checker. Usage guidance is delivered in the MCP initialize
  response; nothing is written to your agent config files.
`))
}
