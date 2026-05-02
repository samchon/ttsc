// Native sidecar entrypoint for `@ttsc/banner`.
//
// The command follows the ttsc plugin sidecar protocol: `check` validates the
// plugin can run, `output` receives one emitted file and may rewrite it, and
// `version` reports the sidecar version. All project semantics stay in the
// host; this binary only prepends configured banner text.
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
    fmt.Fprintln(os.Stderr, "@ttsc/banner: command required (expected output|version)")
    return 2
  }
  switch args[0] {
  case "-v", "--version", "version":
    fmt.Fprintf(os.Stdout, "@ttsc/banner %s\n", version)
    return 0
  case "check":
    // Banner rewriting is output-only; there is no program-wide analysis.
    return 0
  case "output":
    return RunOutput(args[1:])
  default:
    fmt.Fprintf(os.Stderr, "@ttsc/banner: unknown command %q\n", args[0])
    return 2
  }
}
