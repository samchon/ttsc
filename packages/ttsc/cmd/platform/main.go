// Platform helper binary shipped by the per-OS `ttsc-*` packages.
//
// The real compiler and runner commands live in the JavaScript launchers so
// they can resolve the consuming project's `@typescript/native-preview` and
// plugin descriptors. This binary only supplies version/platform metadata and
// a tiny demo command for package smoke tests.
package main

import (
  "flag"
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
  case "demo":
    return runDemo(args[1:])
  case "build", "check":
    fmt.Fprintf(
      stderr,
      "ttsc platform helper: %s is provided by the JavaScript ttsc CLI using the consuming project's @typescript/native-preview, or by a plugin-selected native sidecar.\n",
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
which resolve the consuming project's @typescript/native-preview binary and any
plugin-selected native sidecar.

Usage:
  ttsc --version
  ttsc demo --type=string
`))
}

func runDemo(args []string) int {
  fs := flag.NewFlagSet("demo", flag.ContinueOnError)
  fs.SetOutput(stderr)
  typ := fs.String("type", "string", "atomic type to simulate")
  if err := fs.Parse(args); err != nil {
    return 2
  }

  arrow, err := demoArrow(*typ)
  if err != nil {
    fmt.Fprintf(stderr, "ttsc platform helper demo: %v\n", err)
    return 2
  }

  fmt.Fprintf(stdout, "// demo<%s> -> emitted by ttsc platform helper %s\n", *typ, version)
  fmt.Fprintln(stdout, arrow)
  return 0
}

func demoArrow(name string) (string, error) {
  switch strings.ToLower(name) {
  case "any":
    return "(input) => true", nil
  case "boolean":
    return `(input) => "boolean" === typeof input`, nil
  case "number":
    return `(input) => "number" === typeof input`, nil
  case "bigint":
    return `(input) => "bigint" === typeof input`, nil
  case "string", "":
    return `(input) => "string" === typeof input`, nil
  default:
    return "", fmt.Errorf("unknown --type value %q (want: string|number|boolean|bigint|any)", name)
  }
}
