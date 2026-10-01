package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatPreservesCRLFAcrossReflowRules is the end-to-end regression
// guard for issue #616: `ttsc format` on a CRLF file with
// `format: { endOfLine: "crlf" }` must never persist a lone LF.
//
// Before the fix, format/declaration-header and format/parameter-properties
// synthesized their breaks with a hard-coded "\n", and format/whitespace under
// CRLF does not repair an injected lone LF, so the command wrote a mixed-EOL
// file to disk at exit 0. This drives the whole config -> expansion -> engine
// -> fixer -> disk path and asserts the written file stays uniformly CRLF.
//
//  1. Seed a CRLF class whose header overflows AND whose constructor declares
//     parameter properties, plus a lint config with endOfLine:"crlf".
//  2. Run the format subcommand.
//  3. Assert clean exit, the file changed, both reflows fired with CRLF, and
//     every "\n" belongs to a "\r\n" (zero lone LFs).
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command with endOfLine crlf and printWidth 50 on a CRLF class whose heritage list and parameter-property constructor both overflow, and requires exit 0 with empty output, the file changed, no lone LF, and the substrings `class Repository\r\n` and `constructor(\r\n`.
// @evidence contracts/testing.md#independent-expectations Expectations derive from the endOfLine contract (every LF must belong to a CRLF) and two authored substrings; the complete output text is not compared, so the exact reflowed layout is not pinned here.
// @evidence contracts/testing.md#distinguishing-cases One input that must change, proving both the declaration-header and parameter-properties breaks are emitted with CRLF rather than a hard-coded LF; LF-configured files and other reflow rules are covered elsewhere.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project and JSON config; no child process, built binary or installed consumer.
func TestCommandFormatPreservesCRLFAcrossReflowRules(t *testing.T) {
  input := "class Repository implements First, Second, Third, Fourth, Fifth, Sixth {\r\n" +
    "  constructor(private readonly a: Foo, private readonly b: Bar) {}\r\n" +
    "}\r\n"
  root := seedLintProject(t, input)
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{"endOfLine": "crlf", "printWidth": 50},
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "format",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("format command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  raw, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  got := string(raw)
  if got == input {
    t.Fatalf("expected the file to be reflowed, but it was unchanged:\n%q", got)
  }
  if lf, crlf := strings.Count(got, "\n"), strings.Count(got, "\r\n"); lf != crlf {
    t.Fatalf("output has lone LFs (%d LF, %d CRLF): %q", lf, crlf, got)
  }
  if !strings.Contains(got, "class Repository\r\n") {
    t.Fatalf("declaration-header did not break onto a CRLF line:\n%q", got)
  }
  if !strings.Contains(got, "constructor(\r\n") {
    t.Fatalf("parameter-properties did not break onto a CRLF line:\n%q", got)
  }
}
