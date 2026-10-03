package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandCheckAppliesForwardedTsgoFlag verifies a forwarded tsgo CLI flag
// overrides the project tsconfig for the in-process lint program.
//
// `@ttsc/lint` builds its Program in-process and replays compiler arguments
// through tsgo's own option parser before merging them over the tsconfig.
// The current launcher supplies TTSC_TSGO_ARGS; this unit exercises the host's
// supported explicit --tsgo-args payload instead, without invoking the launcher.
// The fixture's tsconfig sets strict:false, so the strict-null diagnostic
// distinguishes the supplied overlay from the baseline configuration.
//
//  1. Create a project whose tsconfig disables strict mode, with a possibly-null
//     dereference in the source.
//  2. Run `check` with `--tsgo-args ["--strict"]`.
//  3. Assert a non-zero exit and a strict-null diagnostic on stderr.
//
// @evidence contracts/testing.md#behavioral-verification Actual check on authored strict:false is clean; forwarding strict produces status two, empty stdout and TS18047 possibly-null dereference diagnostics from the same source.
// @evidence contracts/testing.md#independent-expectations Authored nullable x.length source and literal strict:false/strict override independently require clean baseline versus TS18047/null error, rather than generating expected flags or diagnostics from product output.
// @evidence contracts/testing.md#distinguishing-cases Baseline without override versus exact strict argument isolates overlay precedence; empty stdout and the specific nullable diagnostic distinguish unrelated configuration failures from effective strict checking.
// @evidence contracts/testing.md#execution-ownership Real in-process command and supported compiler parsing/type checking execute in the Go unit process with temporary project cleanup; no native source build, installed consumer or external compiler is asserted.
func TestCommandCheckAppliesForwardedTsgoFlag(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": false,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"),
    "export const len = (x: string | null): number => x.length;\n")
  baseline, baselineOut, baselineErr := captureCommandOutput(t, func() int { return run([]string{"check", "--cwd", root}) })
  if baseline != 0 || baselineOut != "" || baselineErr != "" { t.Fatalf("authored strict:false baseline should be clean: %d / %q / %q", baseline, baselineOut, baselineErr) }

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--tsgo-args", `["--strict"]`,
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "possibly") {
    t.Fatalf("forwarded --strict not applied: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if !strings.Contains(stderr, "TS18047") || !strings.Contains(stderr, "null") { t.Fatalf("forwarded strict flag did not produce the expected nullable dereference diagnostic: %q", stderr) }
}
