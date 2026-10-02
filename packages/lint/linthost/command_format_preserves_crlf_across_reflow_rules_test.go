package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatPreservesCRLFAcrossReflowRules runs the in-process format
// command on a CRLF class and requires both reflows to preserve its members
// and heritage types while keeping every line break CRLF.
//
// This drives config expansion, the engine, cascading edits and the resulting
// disk bytes. The overflowing heritage list and the two constructor parameter
// properties require new breaks; the literal oracle also protects the class,
// six heritage names, parameter modifiers/types and empty constructor body.
//
//  1. Seed a CRLF class whose header overflows AND whose constructor declares
//     parameter properties, plus a lint config with endOfLine:"crlf".
//  2. Run the format subcommand.
//  3. Assert clean exit, the file changed, both reflows fired with CRLF, and
//     every "\n" belongs to a "\r\n" (zero lone LFs).
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command with endOfLine crlf and printWidth 50 on a CRLF class whose heritage list and parameter-property constructor both overflow, and requires exit 0 with empty output, the file changed, no lone LF, and the substrings `class Repository\r\n` and `constructor(\r\n`.
// @evidence contracts/testing.md#independent-expectations The complete independently authored output preserves the class, all six heritage names and both parameter properties while reflowing them. The separate endOfLine invariant and original two break substrings are retained.
// @evidence contracts/testing.md#distinguishing-cases One input must change in both its heritage header and parameter-property list; complete output and zero lone LFs require both changes with meaning preserved. This entry does not exercise LF-configured files or every other reflow rule.
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
  const want = "class Repository\r\n" +
    "  implements\r\n" +
    "    First,\r\n    Second,\r\n    Third,\r\n    Fourth,\r\n    Fifth,\r\n    Sixth\r\n" +
    "{\r\n" +
    "  constructor(\r\n    private readonly a: Foo,\r\n    private readonly b: Bar,\r\n  ) {}\r\n" +
    "}\r\n"
  if got != want {
    t.Fatalf("reflowed class mismatch:\nwant %q\ngot  %q", want, got)
  }
}
