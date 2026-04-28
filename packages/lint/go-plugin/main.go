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

	"github.com/samchon/ttsc/packages/lint/go-plugin/lint"
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
		fmt.Fprintf(os.Stdout, "@ttsc/lint %s\n", version)
		return 0
	case "check":
		return lint.RunCheck(args[1:])
	case "build":
		return lint.RunBuild(args[1:])
	case "transform":
		return lint.RunTransform(args[1:])
	default:
		fmt.Fprintf(os.Stderr, "@ttsc/lint: unknown command %q\n", args[0])
		return 2
	}
}
