// Library entry for the @ttsc/lint native engine.
//
// The native `@ttsc/lint` CLI lives at `packages/lint/plugin` and is a thin
// wrapper that calls `linthost.Main(os.Args[1:])`. Other consumers (e.g. the
// ttsc.dev playground wasm) link `linthost` directly and dispatch through the
// same entrypoint so the subcommand surface stays in one place.
package linthost

import (
  "fmt"
  "os"
)

// Version is the build banner string the `version` subcommand prints.
// Overridden at link time via
// `-ldflags "-X github.com/samchon/ttsc/packages/lint/linthost.Version=..."`.
// Defaults to `"dev"` so local Go builds and `go test` runs print a
// distinguishable value without depending on the release pipeline.
var Version = "dev"

// Main dispatches the lint plugin subcommands. `args` is the argv tail after
// the binary name (i.e. `os.Args[1:]`). The return value is the exit code the
// caller should propagate to the OS (`os.Exit`) or the host (`Plugin.Run`).
//
// Recognized verbs: `version` / `-v` / `--version`, `check`, `fix`, `format`,
// `build`, `transform`. Anything else is a usage error (exit code 2).
func Main(args []string) int {
  return run(args)
}

// run is the package-local dispatcher invoked by Main and by the in-tree
// test/command corpus, which exercises end-to-end subcommand routing through
// the same entry point the CLI uses.
func run(args []string) int {
  if len(args) == 0 {
    fmt.Fprintln(os.Stderr, "@ttsc/lint: command required (expected check|fix|format|build|transform|version)")
    return 2
  }
  switch args[0] {
  case "-v", "--version", "version":
    // Don't pay contributor-registration cost for the version banner.
    fmt.Fprintf(os.Stdout, "@ttsc/lint %s\n", Version)
    return 0
  case "check", "fix", "format", "build", "transform":
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
  case "fix":
    return RunFix(args[1:])
  case "format":
    return RunFormat(args[1:])
  case "build":
    return RunBuild(args[1:])
  case "transform":
    return RunTransform(args[1:])
  }
  return 2
}
