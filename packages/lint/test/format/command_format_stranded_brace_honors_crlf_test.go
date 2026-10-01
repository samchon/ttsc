package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatStrandedBraceHonorsCRLF verifies the line break inserted
// before a claimed brace uses the file's end-of-line, not a bare LF.
//
// The brace pass inserts a break where no rule inserted one before, so it is a
// new way to reintroduce the mixed-ending defect #616 fixed. The expected
// output is the same shape as the LF case with `\r\n` throughout.
//
//  1. Seed a CRLF one-line block.
//  2. Run `ttsc format`.
//  3. Assert every inserted break is `\r\n` and no lone `\n` survives.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command with endOfLine crlf on `export function f(n: number) { return n; }` (CRLF terminated), requires exit 0 without a did-not-converge message and the exact file `...{\r\n  return n;\r\n}\r\n`, then checks no lone LF remains.
// @evidence contracts/testing.md#independent-expectations The expected text is an authored literal with explicit CRLF separators; the lone-LF check is a second assertion following from the endOfLine contract.
// @evidence contracts/testing.md#distinguishing-cases One changing case where a break is inserted before the closing brace of a function body; it selects crlf specifically, while LF forms and unchanged canonical braces are covered by sibling tests.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: seeds a temp-dir project and calls run with the format subcommand; no child process, built binary or installed consumer.
func TestCommandFormatStrandedBraceHonorsCRLF(t *testing.T) {
  source := "export function f(n: number) { return n; }\r\n"
  want := "export function f(n: number) {\r\n  return n;\r\n}\r\n"

  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{"endOfLine": "crlf"},
  })
  main := filepath.Join(root, "src", "main.ts")

  code, _, stderr := captureCommandOutput(t, func() int {
    return run([]string{"format", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 0 || strings.Contains(stderr, "did not converge") {
    t.Fatalf("format did not converge: code=%d stderr=%q", code, stderr)
  }
  got, err := os.ReadFile(main)
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if string(got) != want {
    t.Fatalf("inserted break must honor CRLF:\ngot  %q\nwant %q", string(got), want)
  }
  if strings.Contains(strings.ReplaceAll(string(got), "\r\n", ""), "\n") {
    t.Fatalf("lone LF survived a CRLF file: %q", string(got))
  }
}
