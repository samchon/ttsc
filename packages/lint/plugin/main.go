// Command @ttsc/lint is the native backend for the `@ttsc/lint` plugin.
//
// The plugin host (ttsc / ttsx) spawns this binary with one of six
// subcommands:
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
  "os"

  "github.com/samchon/ttsc/packages/lint/linthost"
)

func main() {
  os.Exit(linthost.Main(os.Args[1:]))
}
