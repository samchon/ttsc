// Command ttscserver is the Go LSP host shipped by ttsc. It wraps the
// project-selected TypeScript-Go LSP server process and proxies traffic
// between the editor and that server. The JavaScript launcher resolves project
// plugins first and passes an LSP manifest so this command can merge plugin
// diagnostics, code actions, and ttsc-owned executeCommand handling.
//
// The JavaScript launcher (`packages/ttsc/src/launcher/ttscserver.ts`)
// resolves the native binary and forwards stdio so editors can spawn
// `ttscserver --stdio` without worrying about platform helper packages.
//
// Everything here is deliberately small: flag parsing, version metadata,
// and a single delegation to lspserver.RunLSPServer.
package main

import (
  "context"
  "errors"
  "flag"
  "fmt"
  "io"
  "os"
  "os/signal"
  "runtime"
  "strings"
  "syscall"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// Build metadata; overwritten via -ldflags in release builds.
var (
  version = "0.0.0-dev"
  commit  = "dev"
  date    = "unknown"
)

// Package-level writers so command tests can capture output without
// patching os.Stdout / os.Stderr globally.
var (
  stdout io.Writer = os.Stdout
  stderr io.Writer = os.Stderr
  stdin  io.Reader = os.Stdin
)

// runLSPServer is the seam command tests use to substitute a fake LSP
// host. Production wires it to lspserver.RunLSPServer.
var runLSPServer = lspserver.RunLSPServer

// notifyContext is the seam command tests use to substitute a
// deterministic context (no signal hookup) for the signal-aware default.
var notifyContext = signal.NotifyContext

// getwd is the seam command tests use to simulate os.Getwd failures
// (deleted working directory, sandbox restrictions, etc.) without
// modifying the test process cwd.
var getwd = os.Getwd

func main() {
  os.Exit(run(os.Args[1:]))
}

// run dispatches top-level subcommands/flags and returns an exit code.
// Called by main with os.Args[1:] and overridden in tests with a synthetic
// argument slice to avoid spawning a real tsgo process.
func run(args []string) int {
  if len(args) == 0 {
    printHelp(stdout)
    return 0
  }
  switch args[0] {
  case "-h", "--help", "help":
    printHelp(stdout)
    return 0
  case "-v", "--version", "version":
    printVersion(stdout)
    return 0
  }
  return runLSP(args)
}

// runLSP parses LSP-mode flags and starts the proxy. It returns 0 on clean
// shutdown, 1 on a runtime error from the LSP host, and 2 on invalid
// invocation (missing --stdio, unresolvable cwd, unknown flags).
func runLSP(args []string) int {
  fs := flag.NewFlagSet("ttscserver", flag.ContinueOnError)
  fs.SetOutput(stderr)
  stdioFlag := fs.Bool("stdio", false, "communicate with the editor over stdin/stdout")
  cwdFlag := fs.String("cwd", "", "project root (defaults to process cwd)")
  tsconfigFlag := fs.String("tsconfig", "tsconfig.json", "project tsconfig path")
  tsgoFlag := fs.String("tsgo", "", "absolute tsgo binary path (defaults to TTSC_TSGO_BINARY)")
  progressDelayFlag := fs.Duration("progress-delay", 250*time.Millisecond, "accepted for compatibility; ignored by the external tsgo LSP process")
  suppressExecuteCommandProviderFlag := fs.Bool("suppress-execute-command-provider", false, "do not advertise ttsc executeCommand ids during initialize")
  suppressExecuteCommandIDsFlag := fs.String("suppress-execute-command-ids", "", "comma-separated ttsc executeCommand ids to omit during initialize")
  executeCommandIDPrefixFlag := fs.String("execute-command-id-prefix", "", "prefix to apply to advertised executeCommand ids")
  _ = fs.String("clientProcessId", "", "ignored VSCode language-client compatibility flag")
  if err := fs.Parse(args); err != nil {
    return 2
  }
  if !*stdioFlag {
    fmt.Fprintln(stderr, "ttscserver: only --stdio transport is supported")
    return 2
  }

  cwd := strings.TrimSpace(*cwdFlag)
  if cwd == "" {
    resolved, err := getwd()
    if err != nil {
      fmt.Fprintf(stderr, "ttscserver: could not resolve working directory: %v\n", err)
      return 2
    }
    cwd = resolved
  }

  ctx, stop := notifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
  defer stop()

  tsgoBinary := strings.TrimSpace(*tsgoFlag)
  if tsgoBinary == "" {
    tsgoBinary = strings.TrimSpace(os.Getenv("TTSC_TSGO_BINARY"))
  }

  source, err := lspserver.NewNativePluginSource(lspserver.NativePluginSourceOptions{
    Cwd:          cwd,
    Err:          stderr,
    ManifestJSON: os.Getenv("TTSC_LSP_PLUGINS_JSON"),
    Tsconfig:     strings.TrimSpace(*tsconfigFlag),
  })
  if err != nil {
    fmt.Fprintf(stderr, "ttscserver: %v\n", err)
    return 2
  }

  err = runLSPServer(ctx, lspserver.LSPServerOptions{
    In:                             stdin,
    Out:                            stdout,
    Err:                            stderr,
    Cwd:                            cwd,
    TsgoBinary:                     tsgoBinary,
    Source:                         source,
    SuppressExecuteCommandProvider: *suppressExecuteCommandProviderFlag,
    SuppressedExecuteCommandIDs:    splitCSV(*suppressExecuteCommandIDsFlag),
    ExecuteCommandIDPrefix:         strings.TrimSpace(*executeCommandIDPrefixFlag),
    ProgressDelay:                  *progressDelayFlag,
  })
  if err != nil && !errors.Is(err, context.Canceled) {
    fmt.Fprintf(stderr, "ttscserver: %v\n", err)
    return 1
  }
  return 0
}

func printVersion(w io.Writer) {
  fmt.Fprintf(
    w,
    "ttscserver %s (commit %s, built %s, %s/%s, go %s)\n",
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
ttscserver — Language Server Protocol host for ttsc.

Usage:
  ttscserver --stdio
  ttscserver --version
  ttscserver --help

Options:
  --stdio              Communicate with the editor over stdin/stdout.
  --cwd <dir>          Project root used as the tsgo server working directory.
  --tsconfig <path>    Project config path used by ttsc plugin sidecars.
  --tsgo <path>        Absolute tsgo binary path (defaults to TTSC_TSGO_BINARY).
  --suppress-execute-command-provider
                       Do not advertise ttsc executeCommand ids during initialize.
  --suppress-execute-command-ids <ids>
                       Comma-separated executeCommand ids to omit during initialize.
  --execute-command-id-prefix <prefix>
                       Prefix advertised executeCommand ids for multi-client hosts.
  --progress-delay D   Accepted for compatibility; currently ignored by the external tsgo LSP process.

Typical embedding:
  Editors spawn ttscserver via the JavaScript launcher (resolves the
  per-platform native binary and passes the project tsgo path) and exchange
  LSP messages over stdio. The upstream tsgo server provides hover,
  completion, definitions, and diagnostics. LSP-capable ttsc sidecars are
  discovered by the JavaScript launcher and merged into the same stream.
`))
}

func splitCSV(value string) []string {
  if value == "" {
    return nil
  }
  fields := strings.Split(value, ",")
  out := make([]string, 0, len(fields))
  for _, field := range fields {
    trimmed := strings.TrimSpace(field)
    if trimmed != "" {
      out = append(out, trimmed)
    }
  }
  return out
}
