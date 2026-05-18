// Command ttscserver is the Go LSP host shipped by ttsc. It wraps the
// project-selected TypeScript-Go LSP server process and proxies traffic
// between the editor and that server, splicing ttsc-plugin diagnostics,
// code actions, and ttsc-owned executeCommand handling into the same stream.
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

func runLSP(args []string) int {
	fs := flag.NewFlagSet("ttscserver", flag.ContinueOnError)
	fs.SetOutput(stderr)
	stdioFlag := fs.Bool("stdio", false, "communicate with the editor over stdin/stdout")
	cwdFlag := fs.String("cwd", "", "project root (defaults to process cwd)")
	tsgoFlag := fs.String("tsgo", "", "absolute tsgo binary path (defaults to TTSC_TSGO_BINARY)")
	progressDelayFlag := fs.Duration("progress-delay", 250*time.Millisecond, "delay before showing tsgo's progress UI")
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

	err := runLSPServer(ctx, lspserver.LSPServerOptions{
		In:            stdin,
		Out:           stdout,
		Err:           stderr,
		Cwd:           cwd,
		TsgoBinary:    tsgoBinary,
		Source:        lspserver.NullPluginSource{},
		ProgressDelay: *progressDelayFlag,
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
  --tsgo <path>        Absolute tsgo binary path (defaults to TTSC_TSGO_BINARY).
  --progress-delay D   Accepted for compatibility; tsgo currently owns this value.

Typical embedding:
  Editors spawn ttscserver via the JavaScript launcher (resolves the
  per-platform native binary and passes the project tsgo path) and exchange
  LSP messages over stdio. The upstream tsgo server provides hover,
  completion, definitions, and diagnostics; ttsc merges plugin diagnostics,
  code actions, and ttsc-owned executeCommand handlers into the same stream.
`))
}
