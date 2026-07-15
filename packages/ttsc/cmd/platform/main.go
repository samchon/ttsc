// Platform helper binary shipped by the per-OS `ttsc-*` packages.
//
// The real compiler and runner commands live in the JavaScript launchers so
// they can resolve the consuming project's `typescript` and
// plugin descriptors. This binary only supplies version/platform metadata.
package main

import (
  "fmt"
  "io"
  "os"
  "runtime"
  "strings"
)

var (
  // These values are overwritten by release builds through -ldflags. The
  // defaults keep local `go run` and fixture builds deterministic.
  version = "0.0.0-dev"
  commit  = "dev"
  date    = "unknown"
)

var (
  // Package-level writers keep CLI tests simple and avoid global os.Stdout /
  // os.Stderr patching.
  stdout io.Writer = os.Stdout
  stderr io.Writer = os.Stderr
)

func main() {
  os.Exit(run(os.Args[1:]))
}

// run dispatches CLI arguments for the platform helper binary. With no
// arguments it prints the help text. build/check print an explanatory error
// directing users to the JavaScript launcher instead of failing silently.
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
  case "build", "check":
    fmt.Fprintf(
      stderr,
      "ttsc platform helper: %s is provided by the JavaScript ttsc CLI using the consuming project's typescript, or by a plugin-selected native sidecar.\n",
      args[0],
    )
    return 2
  default:
    fmt.Fprintf(stderr, "ttsc platform helper: unknown command %q\n", args[0])
    fmt.Fprintln(stderr, `ttsc platform helper: run "ttsc --help" through the JavaScript CLI for compiler usage.`)
    return 2
  }
}

func printVersion(w io.Writer) {
  fmt.Fprintf(
    w,
    "ttsc platform helper %s (commit %s, built %s, %s/%s, go %s)\n",
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
ttsc platform helper.

This binary is a small compatibility helper shipped by @ttsc platform packages.
Compiler and runner commands are provided by the JavaScript ttsc/ttsx launchers,
which resolve the consuming project's typescript binary and any
plugin-selected native sidecar.

Usage:
  ttsc --version
`))
}
