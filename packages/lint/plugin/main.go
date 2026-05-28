// Command @ttsc/lint is the native backend for the `@ttsc/lint` plugin.
//
// The plugin host (ttsc / ttsx) spawns this binary with one of these
// subcommands (canonical list lives in `linthost/dispatch.go`):
//
//   - `version` / `-v` / `--version` — print the binary banner.
//   - `check` — typecheck + lint without emit. Failure exit code if any
//     error-severity diagnostic fires.
//   - `fix` — apply lint-rule autofixes, then typecheck + lint without
//     emit.
//   - `format` — apply format-rule edits only. Write-only: no diagnostic
//     output, no typecheck recheck.
//   - `build` — typecheck + lint, then run the standard tsgo emit pipeline
//     so JS files land on disk.
//   - `transform --file=PATH` — single-file emit with the same lint pass.
//   - `lsp-command-ids` — print workspace/executeCommand ids owned by
//     `@ttsc/lint`.
//   - `lsp-code-action-kinds` — print CodeActionKind values offered.
//   - `lsp-diagnostics` — produce LSP diagnostic JSON for one file URI.
//   - `lsp-code-actions` — produce LSP code actions for one file URI.
//   - `lsp-execute-command` — return a WorkspaceEdit for a lint-owned
//     command.
//
// Diagnostics share the renderer with tsgo's own output, so warnings come
// out yellow, errors come out red, and the trailing `Found N errors`
// summary is consistent with `tsc --noEmit`.
//
// Behavior lives in the sibling `linthost` library package. This binary is a
// thin wrapper so out-of-process consumers (the native CLI here) and
// in-process consumers (the ttsc.dev playground wasm) share the same
// dispatch surface.
package main

import (
  "fmt"
  "os"
  "runtime"
  "runtime/pprof"

  "github.com/samchon/ttsc/packages/lint/linthost"
)

func main() {
  // Opt-in CPU profile capture for the lint binary. Set
  // `TTSC_LINT_CPUPROFILE=/path/to/out.prof` before running `ttsc check`
  // to record where the in-process lint engine spends time on a real
  // project. The file is flushed before the process exits; the binary's
  // exit code is unchanged. NOTE: `os.Exit` skips deferred calls, so the
  // profile must be stopped explicitly before exit — `defer
  // pprof.StopCPUProfile()` would silently produce a zero-byte file.
  var profileFile *os.File
  if path := os.Getenv("TTSC_LINT_CPUPROFILE"); path != "" {
    f, err := os.Create(path)
    if err != nil {
      fmt.Fprintf(os.Stderr, "@ttsc/lint: cannot create cpuprofile %q: %v\n", path, err)
    } else if err := pprof.StartCPUProfile(f); err != nil {
      fmt.Fprintf(os.Stderr, "@ttsc/lint: pprof.StartCPUProfile: %v\n", err)
      f.Close()
    } else {
      profileFile = f
    }
  }
  code := linthost.Main(os.Args[1:])
  if profileFile != nil {
    pprof.StopCPUProfile()
    profileFile.Close()
  }
  if path := os.Getenv("TTSC_LINT_MEMPROFILE"); path != "" {
    f, err := os.Create(path)
    if err != nil {
      fmt.Fprintf(os.Stderr, "@ttsc/lint: cannot create memprofile %q: %v\n", path, err)
    } else {
      runtime.GC()
      if err := pprof.WriteHeapProfile(f); err != nil {
        fmt.Fprintf(os.Stderr, "@ttsc/lint: pprof.WriteHeapProfile: %v\n", err)
      }
      f.Close()
    }
  }
  os.Exit(code)
}
