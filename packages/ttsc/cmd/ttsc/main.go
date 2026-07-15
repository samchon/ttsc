// Command ttsc is the Go CLI entrypoint for ttsc.
//
// Current responsibilities:
//   - Report version and platform (`ttsc --version`).
//   - Host the native project build and check paths used by plugin-selected
//     sidecars and smoke tests.
//
// Everything below is deliberately dependency-free so that the standalone binary
// stays small and its behavior is trivial to audit.
package main

import (
  "fmt"
  "io"
  "os"
  "runtime"
  "strings"
)

// These are overridden via `-ldflags "-X main.version=... -X main.commit=..."`
// in CI. Sensible defaults keep local `go run ./cmd/ttsc` usable.
var (
  version = "0.0.0-dev"
  commit  = "dev"
  date    = "unknown"
)

// stdout / stderr are package-level to keep the CLI testable.
var (
  stdout io.Writer = os.Stdout
  stderr io.Writer = os.Stderr
  getwd            = os.Getwd
)

func main() {
  os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
  if len(args) == 0 {
    return runBuild(nil)
  }

  switch args[0] {
  case "-h", "--help", "help":
    printHelp(stdout)
    return 0
  case "-v", "--version", "version":
    printVersion(stdout)
    return 0
  case "build":
    return runBuild(args[1:])
  case "api-compile":
    return runAPICompile(args[1:])
  case "api-transform":
    return runAPITransform(args[1:])
  case "check":
    // `ttsc check` runs the analyze pipeline without emitting JS — useful
    // in CI and pre-commit checks that only need schema validation.
    return runBuild(append([]string{"--noEmit"}, args[1:]...))
  case "-p", "--project":
    if len(args) < 2 {
      fmt.Fprintln(stderr, "ttsc: -p/--project requires a path argument")
      return 2
    }
    return runBuild(append([]string{"--tsconfig=" + args[1]}, args[2:]...))
  default:
    if isBuildAlias(args[0]) {
      return runBuild(args)
    }
    fmt.Fprintf(stderr, "ttsc: unknown command %q\n", args[0])
    fmt.Fprintln(stderr, `ttsc: run "ttsc --help" to see supported commands`)
    return 2
  }
}

// isBuildAlias reports whether arg should be forwarded to runBuild without
// requiring an explicit "build" verb. Any flag-shaped argument (leading "-")
// or a TypeScript-project file extension is treated as a build alias, matching
// the tsc/tsgo invocation convention.
func isBuildAlias(arg string) bool {
  if strings.HasPrefix(arg, "-") {
    return true
  }
  switch {
  case strings.HasSuffix(arg, ".json"),
    strings.HasSuffix(arg, ".ts"),
    strings.HasSuffix(arg, ".tsx"),
    strings.HasSuffix(arg, ".mts"),
    strings.HasSuffix(arg, ".cts"):
    return true
  default:
    return false
  }
}

func printVersion(w io.Writer) {
  fmt.Fprintf(
    w,
    "ttsc %s (commit %s, built %s, %s/%s, go %s)\n",
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
ttsc — standalone typescript-go host.

Usage:
  ttsc
  ttsc -p tsconfig.json
  ttsc --watch
  ttsc --noEmit

Project build:
  ttsc compiles the current tsconfig.json, matching the tsc/tsgo shape.
  build         Compatibility alias for the same project build lane.
  check         Compatibility alias for --noEmit validation.
  version       Print version, build info, and platform.
  help          Show this help.

Build options:
  --tsconfig=FILE   Path to tsconfig.json (default: tsconfig.json).
  --cwd=DIR         Override working directory.
  --emit            Force emitted .js files even when tsconfig has noEmit.
  --noEmit          Force analysis-only run even when tsconfig would emit.
  --quiet           Suppress the per-call summary banner (default).
  --verbose         Print the per-call summary banner and emitted file list.
  --manifest=FILE   Write emitted file paths as JSON to FILE after build --emit.

Examples:
  ttsc --version
  ttsc
  ttsc -p ./tsconfig.json
  ttsc --noEmit

Integration guide (bundlers):
  - Next.js / Nuxt / Bun: "ttsc" in your pipeline replaces tsc and
    the rewritten .js feeds the runtime directly.
  - Monorepo / pnpm workspace: share one ttsc binary via a root script;
    per-package tsconfig.json references work unchanged.
`))
}
