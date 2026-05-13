// Command @ttsc/lint is the native backend for the `@ttsc/lint` plugin.
//
// The plugin host (ttsc / ttsx) spawns this binary with one of four
// subcommands:
//
//   - `version` / `-v` / `--version` — print the binary banner.
//   - `check` — typecheck + lint without emit. Failure exit code if any
//     error-severity diagnostic fires.
//   - `build` — typecheck + lint, then run the standard tsgo emit pipeline
//     so JS files land on disk.
//   - `transform --file=PATH` — single-file emit with the same lint pass.
//
// Diagnostics share the renderer with tsgo's own output, so warnings come
// out yellow, errors come out red, and the trailing `Found N errors`
// summary is consistent with `tsc --noEmit`.
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
    fmt.Fprintln(os.Stderr, "@ttsc/lint: command required (expected check|build|transform|version)")
    return 2
  }
  switch args[0] {
  case "-v", "--version", "version":
    // Don't pay contributor-registration cost for the version banner.
    fmt.Fprintf(os.Stdout, "@ttsc/lint %s\n", version)
    return 0
  case "check", "build", "transform":
  default:
    fmt.Fprintf(os.Stderr, "@ttsc/lint: unknown command %q\n", args[0])
    return 2
  }
  // Wire contributor rules into the engine's dispatch table after every
  // package init has settled. See contrib_adapter.go for the rationale.
  registerContributors()
  switch args[0] {
  case "check":
    return RunCheck(args[1:])
  case "build":
    return RunBuild(args[1:])
  case "transform":
    return RunTransform(args[1:])
  }
  return 2
}
