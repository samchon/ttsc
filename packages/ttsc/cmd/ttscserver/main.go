// Command ttscserver is the Go LSP host shipped by ttsc. It wraps the
// project-selected TypeScript-Go LSP server process and proxies traffic
// between the editor and that server. The JavaScript launcher resolves project
// plugins first and passes a private LSP manifest file so this command can
// merge plugin diagnostics, code actions, and ttsc-owned executeCommand
// handling.
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
  "encoding/json"
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

  "github.com/samchon/ttsc/packages/ttsc/internal/graphsymbols"
  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

const lspPluginManifestMaxBytes = 64 * 1024 * 1024

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
  if len(args) != 0 && args[0] == "--ttsc-resolve-launch" {
    return resolveLaunch(args[1:])
  }
  switch metaCommand(args) {
  case "help":
    printHelp(stdout)
    return 0
  case "version":
    printVersion(stdout)
    return 0
  }
  return runLSP(args)
}

// metaCommand is shared by normal dispatch and the launcher's private query so
// even a metadata invocation with trailing LSP flags never prepares a project.
func metaCommand(args []string) string {
  if len(args) == 0 {
    return "help"
  }
  switch args[0] {
  case "-h", "--help", "help":
    return "help"
  case "-v", "--version", "version":
    return "version"
  }
  return ""
}

// lspLaunchOptions carries the Go-owned interpretation to Node before package
// resolution. Remaining fields stay private to the native host's startup.
type lspLaunchOptions struct {
  LSP                            bool          `json:"lsp"`
  Cwd                            string        `json:"cwd"`
  Tsconfig                       string        `json:"tsconfig"`
  TsconfigExplicit               bool          `json:"tsconfigExplicit"`
  TsgoBinary                     string        `json:"tsgo"`
  PluginsFile                    string        `json:"-"`
  ProgressDelay                  time.Duration `json:"-"`
  SuppressExecuteCommandProvider bool          `json:"-"`
  SuppressedExecuteCommandIDs     string        `json:"-"`
  ExecuteCommandIDPrefix          string        `json:"-"`
}

// resolveLaunch is a private launcher/native protocol. It uses the same parser
// as runLSP without reading a manifest, creating a plugin source, or starting
// signal handling. The original argv is still used by the eventual host.
func resolveLaunch(args []string) int {
  options := &lspLaunchOptions{}
  if metaCommand(args) == "" {
    var code int
    options, code = parseLSPLaunch(args)
    if code != 0 {
      return code
    }
  }
  if err := json.NewEncoder(stdout).Encode(options); err != nil {
    fmt.Fprintf(stderr, "ttscserver: write launch options: %v\n", err)
    return 1
  }
  return 0
}

// runLSP parses LSP-mode flags and starts the proxy. It returns 0 on clean
// shutdown, 1 on a runtime error from the LSP host, and 2 on invalid
// invocation (missing --stdio, unresolvable cwd, unknown flags).
func runLSP(args []string) int {
  options, code := parseLSPLaunch(args)
  if code != 0 {
    return code
  }
  return startLSP(options)
}

// parseLSPLaunch owns all native flag definitions, spelling, ordering and
// termination rules for both launcher preparation and actual server startup.
// It resolves only process defaults, leaving project-dependent work to callers.
func parseLSPLaunch(args []string) (*lspLaunchOptions, int) {
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
  // Only an invocation with plugins or tracked selection inputs needs this
  // transport. The private launch query establishes parser compatibility before
  // the JavaScript launcher resolves either input population.
  lspPluginsFileFlag := fs.String("lsp-plugins-file", "", "path to the private LSP plugin manifest written by the ttsc launcher")
  _ = fs.String("clientProcessId", "", "ignored VSCode language-client compatibility flag")
  if err := fs.Parse(args); err != nil {
    return nil, 2
  }
  if !*stdioFlag {
    fmt.Fprintln(stderr, "ttscserver: only --stdio transport is supported")
    return nil, 2
  }

  cwd := strings.TrimSpace(*cwdFlag)
  if cwd == "" {
    resolved, err := getwd()
    if err != nil {
      fmt.Fprintf(stderr, "ttscserver: could not resolve working directory: %v\n", err)
      return nil, 2
    }
    cwd = resolved
  }

  tsgoBinary := strings.TrimSpace(*tsgoFlag)
  if tsgoBinary == "" {
    tsgoBinary = strings.TrimSpace(os.Getenv("TTSC_TSGO_BINARY"))
  }

  explicitTsconfig := false
  fs.Visit(func(value *flag.Flag) {
    if value.Name == "tsconfig" {
      explicitTsconfig = true
    }
  })
  return &lspLaunchOptions{
    LSP:                            true,
    Cwd:                            cwd,
    Tsconfig:                       strings.TrimSpace(*tsconfigFlag),
    TsconfigExplicit:               explicitTsconfig,
    TsgoBinary:                     tsgoBinary,
    PluginsFile:                    strings.TrimSpace(*lspPluginsFileFlag),
    ProgressDelay:                  *progressDelayFlag,
    SuppressExecuteCommandProvider: *suppressExecuteCommandProviderFlag,
    SuppressedExecuteCommandIDs:    *suppressExecuteCommandIDsFlag,
    ExecuteCommandIDPrefix:         strings.TrimSpace(*executeCommandIDPrefixFlag),
  }, 0
}

// startLSP owns manifest consumption and the actual signal-aware server
// lifetime after the native argument parser accepted the invocation.
func startLSP(options *lspLaunchOptions) int {
  ctx, stop := notifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
  defer stop()

  manifestJSON, err := lspPluginManifestJSON(options.PluginsFile)
  if err != nil {
    fmt.Fprintf(stderr, "ttscserver: %v\n", err)
    return 2
  }
  source, err := lspserver.NewNativePluginSource(lspserver.NativePluginSourceOptions{
    Cwd:          options.Cwd,
    Err:          stderr,
    ManifestJSON: manifestJSON,
    Tsconfig:     options.Tsconfig,
  })
  if err != nil {
    fmt.Fprintf(stderr, "ttscserver: %v\n", err)
    return 2
  }

  // The SymbolProvider answers textDocument/documentSymbol and
  // textDocument/references from ttsc's compiler-backed code graph. tsgo
  // implements both methods itself, so the proxy forwards to tsgo whenever it
  // advertises the capability and consults this provider only as a fallback
  // (tsgo did not advertise). It loads the program lazily on the first such
  // request, so wiring it here adds no startup cost.
  symbolProvider := graphsymbols.NewProvider(options.Cwd, options.Tsconfig)

  err = runLSPServer(ctx, lspserver.LSPServerOptions{
    In:                             stdin,
    Out:                            stdout,
    Err:                            stderr,
    Cwd:                            options.Cwd,
    TsgoBinary:                     options.TsgoBinary,
    Source:                         source,
    SymbolProvider:                 symbolProvider,
    SuppressExecuteCommandProvider: options.SuppressExecuteCommandProvider,
    SuppressedExecuteCommandIDs:    splitCSV(options.SuppressedExecuteCommandIDs),
    ExecuteCommandIDPrefix:         options.ExecuteCommandIDPrefix,
    ProgressDelay:                  options.ProgressDelay,
  })
  if err != nil && !errors.Is(err, context.Canceled) {
    fmt.Fprintf(stderr, "ttscserver: %v\n", err)
    return 1
  }
  return 0
}

// lspPluginManifestJSON reads the private plugin manifest prepared for this
// process and takes ownership of it.
//
// The manifest names every resolved project plugin and its launch context, so
// the copy this process was given to own is consumed exactly once: the file the
// launcher named with the flag must be removed after a successful read before
// startup continues. A removal failure is reported; deletion cannot be promised
// if the process is killed before consumption or the filesystem denies it.
//
// Both transport variables are cleared from this process either way, so later
// plugin sidecars inherit neither the payload nor its path. Environment forms
// support editors that invoke a native binary directly. Those files remain
// caller-owned and are read without removal.
func lspPluginManifestJSON(flagLocation string) (string, error) {
  defer func() {
    os.Unsetenv("TTSC_LSP_PLUGINS_FILE")
    os.Unsetenv("TTSC_LSP_PLUGINS_JSON")
  }()
  if flagLocation != "" {
    body, err := readLSPPluginManifestFile("--lsp-plugins-file", flagLocation)
    if err != nil {
      return "", err
    }
    // Only the flag names a file the launcher created for this process, so
    // only that one is consumed here. An out-of-band file remains caller-owned.
    // Another cleanup owner may already have removed it after the read.
    if err := os.Remove(flagLocation); err != nil && !errors.Is(err, os.ErrNotExist) {
      return "", fmt.Errorf("consume --lsp-plugins-file: %w", err)
    }
    return body, nil
  }
  location := strings.TrimSpace(os.Getenv("TTSC_LSP_PLUGINS_FILE"))
  if location == "" {
    return os.Getenv("TTSC_LSP_PLUGINS_JSON"), nil
  }
  return readLSPPluginManifestFile("TTSC_LSP_PLUGINS_FILE", location)
}

func readLSPPluginManifestFile(source, location string) (string, error) {
  input, err := os.Open(location)
  if err != nil {
    return "", fmt.Errorf("read %s: %w", source, err)
  }
  defer input.Close()
  body, err := io.ReadAll(io.LimitReader(input, lspPluginManifestMaxBytes+1))
  if err != nil {
    return "", fmt.Errorf("read %s: %w", source, err)
  }
  if len(body) > lspPluginManifestMaxBytes {
    return "", fmt.Errorf(
      "%s exceeds %d bytes",
      source,
      lspPluginManifestMaxBytes,
    )
  }
  return string(body), nil
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
  --lsp-plugins-file <path>
                       Private plugin manifest written by the ttsc launcher; it is
                       consumed and deleted at startup. Editors that spawn this
                       binary directly supply their own manifest through
                       TTSC_LSP_PLUGINS_FILE instead, which is never deleted.
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
