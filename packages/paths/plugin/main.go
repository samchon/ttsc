// Native sidecar entrypoint for `@ttsc/paths`.
//
// The sidecar implements an output-stage transform. It reads emitted JS or
// declaration text, resolves bare specifiers covered by tsconfig `paths`, and
// rewrites them to relative runtime paths.
package main

import (
  "fmt"
  "os"
)

const version = "0.0.1"

func main() {
  os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
  if len(args) == 0 {
    fmt.Fprintln(os.Stderr, "@ttsc/paths: command required (expected output|version)")
    return 2
  }
  switch args[0] {
  case "-v", "--version", "version":
    fmt.Fprintf(os.Stdout, "@ttsc/paths %s\n", version)
    return 0
  case "check":
    // Path rewriting depends on emitted output, so check has no standalone
    // diagnostics beyond command availability.
    return 0
  case "output":
    return RunOutput(args[1:])
  default:
    fmt.Fprintf(os.Stderr, "@ttsc/paths: unknown command %q\n", args[0])
    return 2
  }
}
