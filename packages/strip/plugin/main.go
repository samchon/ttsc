// Native sidecar entrypoint for `@ttsc/strip`.
//
// The sidecar implements an output-stage transform for JavaScript emit. It
// removes configured call statements and optional debugger statements after
// TypeScript-Go prints JS, leaving typechecking and project loading to ttsc.
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
    fmt.Fprintln(os.Stderr, "@ttsc/strip: command required (expected output|version)")
    return 2
  }
  switch args[0] {
  case "-v", "--version", "version":
    fmt.Fprintf(os.Stdout, "@ttsc/strip %s\n", version)
    return 0
  case "check":
    // Strip rewriting is output-only; configuration is validated when output
    // text is actually transformed.
    return 0
  case "output":
    return RunOutput(args[1:])
  default:
    fmt.Fprintf(os.Stderr, "@ttsc/strip: unknown command %q\n", args[0])
    return 2
  }
}
