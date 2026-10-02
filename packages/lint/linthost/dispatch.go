// Library entry for the @ttsc/lint native engine.
//
// The native `@ttsc/lint` CLI lives at `packages/lint/plugin` and is a thin
// wrapper that calls `linthost.Main(os.Args[1:])`. Other consumers (e.g. the
// ttsc.dev playground wasm) link `linthost` directly and dispatch through the
// same entrypoint so the subcommand surface stays in one place.
package linthost

import (
  "fmt"
  "io"
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
// Recognized verbs: `version` / `-v` / `--version`, `check`, `check-serve`,
// `fix`, `format`, `build`, `transform`, `project-inputs`, `graph-nodes`, and
// the `lsp-*` protocol commands consumed by ttscserver. Anything else is a
// usage error (exit code 2).
//
// @evidence contracts/common.md#principled-implementation The argv tail selects the canonical command route and its returned exit code, with unknown verbs producing the documented usage failure.
// @evidence contracts/common.md#clear-and-simple-design The public entry delegates to one command dispatcher shared by native consumers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Command names are the supported CLI discriminants, and contributor registration uses its normal bootstrap rather than patched dispatch.
// @evidence contracts/common.md#meaningful-documentation Native prose states argument ownership, supported verbs and exit-code propagation; paragraphs and tags follow documentation guidance.
// @evidence contracts/portability.md#os-neutral-implementation Main forwards argv elements rather than constructing shell text. Selected commands own native cwd/config/source paths, filesystem or process operations and host-specific representations; browser-supported routing and writer injection do not remove those delegated boundaries. This dispatcher neither guesses file identity from OS names nor rewrites path case.
// @evidence contracts/performance.md#efficient-algorithms Command selection has a fixed set of verb branches plus input/output string bytes. Valid project routes also wait for shared contributor bootstrap, whose first execution inspects and sorts registered metadata and installs adapters, then pay the chosen command's parsing, project/config and diagnostic or emit work. No constant bound for the complete dispatched invocation is claimed.
// @evidence contracts/performance.md#reuse-equivalent-work Valid routes share completed or in-flight contributor initialization through sync.Once because immutable init-time registries determine the same installed adapters. Each selected command retains its own config/Program reuse premises; returned exit codes or matching argv alone do not justify replaying effectful commands. Version and rejected verbs skip bootstrap.
// @evidence contracts/performance.md#bound-retention-and-release-resources Argv and output streams remain caller/process-owned. Bootstrap installs process-lifetime contributor adapters with no unregister or count cap; the selected command owns Program, temporary files, evaluator children or resident sessions and their release. The dispatcher returns that command's exit code and introduces no independent command-state cache, resource cap or cancellation deadline.
func Main(args []string) int {
  return run(args)
}

// MainWithIO dispatches the browser-owned project commands without consulting
// process-global stdout or stderr. Native-only mutation and LSP commands retain
// Main as their CLI entrypoint.
//
// @evidence contracts/common.md#principled-implementation Explicit command output streams and browser-supported check/build/transform routes preserve command writer ownership; nil writers discard command output and unavailable verbs fail. Shared bootstrap warnings remain a process-level channel.
// @evidence contracts/common.md#clear-and-simple-design One browser dispatcher passes stream ownership directly to the existing project commands.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The narrower command surface is a documented host boundary rather than process-global stdout replacement.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes command-owned streams, process-level bootstrap warnings and the native mutation/LSP entry; separated tags follow documentation guidance.
// @evidence contracts/portability.md#os-neutral-implementation MainWithIO forwards argv elements rather than constructing shell text. Selected commands own native cwd/config/source paths, filesystem or process operations and host-specific representations; browser-supported routing and writer injection do not remove those delegated boundaries. This dispatcher neither guesses file identity from OS names nor rewrites path case.
// @evidence contracts/performance.md#efficient-algorithms Command selection has a fixed set of verb branches plus input/output string bytes. Valid project routes also wait for shared contributor bootstrap, whose first execution inspects and sorts registered metadata and installs adapters, then pay the chosen command's parsing, project/config and diagnostic or emit work. No constant bound for the complete dispatched invocation is claimed.
// @evidence contracts/performance.md#reuse-equivalent-work Valid routes share completed or in-flight contributor initialization through sync.Once because immutable init-time registries determine the same installed adapters. Each selected command retains its own config/Program reuse premises; returned exit codes or matching argv alone do not justify replaying effectful commands. Version and rejected verbs skip bootstrap.
// @evidence contracts/performance.md#bound-retention-and-release-resources Argv and output streams remain caller/process-owned. Bootstrap installs process-lifetime contributor adapters with no unregister or count cap; the selected command owns Program, temporary files, evaluator children or resident sessions and their release. The dispatcher returns that command's exit code and introduces no independent command-state cache, resource cap or cancellation deadline.
func MainWithIO(args []string, stdout, stderr io.Writer) int {
  if stdout == nil {
    stdout = io.Discard
  }
  if stderr == nil {
    stderr = io.Discard
  }
  if len(args) == 0 {
    fmt.Fprintln(stderr, "@ttsc/lint: command required (expected check|build|transform|version)")
    return 2
  }
  switch args[0] {
  case "-v", "--version", "version":
    fmt.Fprintf(stdout, "@ttsc/lint %s\n", Version)
    return 0
  case "check":
    registerContributorsOnce()
    return RunCheckWithIO(args[1:], stdout, stderr)
  case "build":
    registerContributorsOnce()
    return RunBuildWithIO(args[1:], stdout, stderr)
  case "transform":
    registerContributorsOnce()
    return RunTransformWithIO(args[1:], stdout, stderr)
  default:
    fmt.Fprintf(stderr, "@ttsc/lint: command %q is unavailable in the browser host\n", args[0])
    return 2
  }
}

// run is the package-local dispatcher invoked by Main and by the package's
// command tests, which exercise subcommand routing through the same entry point
// the CLI uses.
func run(args []string) int {
  if len(args) == 0 {
    fmt.Fprintln(os.Stderr, "@ttsc/lint: command required (expected check|fix|format|build|transform|lsp-*|version)")
    return 2
  }
  switch args[0] {
  case "-v", "--version", "version":
    // Don't pay contributor-registration cost for the version banner.
    fmt.Fprintf(os.Stdout, "@ttsc/lint %s\n", Version)
    return 0
  case "check", "check-serve", "fix", "format", "build", "transform", "project-inputs", "lsp-command-ids", "lsp-code-action-kinds", "lsp-diagnostics", "lsp-project-diagnostics", "lsp-code-actions", "lsp-execute-command", "lsp-hints", "graph-nodes", "lsp-serve":
  default:
    fmt.Fprintf(os.Stderr, "@ttsc/lint: unknown command %q\n", args[0])
    return 2
  }
  // Wire init-time contributor rules into the engine's dispatch table once,
  // after every package init has settled. See contrib_adapter.go.
  registerContributorsOnce()
  switch args[0] {
  case "check":
    return RunCheck(args[1:])
  case "check-serve":
    return RunCheckServe(os.Stdin, os.Stdout, args[1:])
  case "fix":
    return RunFix(args[1:])
  case "format":
    return RunFormat(args[1:])
  case "build":
    return RunBuild(args[1:])
  case "transform":
    return RunTransform(args[1:])
  case "project-inputs":
    return RunProjectInputs(args[1:])
  case "lsp-command-ids":
    return RunLSPCommandIDs(args[1:])
  case "lsp-code-action-kinds":
    return RunLSPCodeActionKinds(args[1:])
  case "lsp-diagnostics":
    return RunLSPDiagnostics(args[1:])
  case "lsp-project-diagnostics":
    return RunLSPProjectDiagnostics(args[1:])
  case "lsp-code-actions":
    return RunLSPCodeActions(args[1:])
  case "lsp-execute-command":
    return RunLSPExecuteCommand(args[1:])
  case "lsp-hints":
    return RunLSPHints(args[1:])
  case "graph-nodes":
    return RunGraphNodes(args[1:])
  case "lsp-serve":
    return RunLSPServe(os.Stdin, os.Stdout, args[1:])
  }
  return 2
}
