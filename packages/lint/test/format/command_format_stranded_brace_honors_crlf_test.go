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
// @evidence contracts/testing.md#behavioral-verification The format command must expand a single-line function into an indented CRLF block and converge without a lone LF.
// @evidence contracts/testing.md#independent-expectations The independently authored expected function preserves its signature and return expression and specifies every CRLF separator; the separate LF check detects mixed endings.
// @evidence contracts/testing.md#distinguishing-cases A changed single-line body complements canonical unchanged brace fixtures. This case specifically selects endOfLine crlf.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatStrandedBraceHonorsCRLF is a public format unit selected by TestSelectedLintUnits. The isolated fixture filesystem feeds the actual Go command entry in the shared process. This verifies command semantics without compiling or launching a native artifact or installing a consumer.
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
