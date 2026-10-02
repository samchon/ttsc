package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFixSkipsDefaultFormattingThatFormatApplies pins the `ttsc fix` vs
// `ttsc format` formatting contract on a project with NO `format` block.
//
// `ttsc format` loads the always-on default formatter (format/semi here), so it
// closes a missing statement terminator even without a configured block.
// `ttsc fix` deliberately does not: it applies lint autofixes and only the
// format rules a `format` block configured, so with no block the same source
// keeps its missing semicolons as a pure lint pass. Running both commands on
// identical input and asserting the two outputs diverge locks that intentional
// asymmetry (fix.go's resolver choice) against a regression that silently routes
// fix through the default formatter.
//
//  1. Seed two copies of one source with a no-var violation and three missing
//     semicolons, with only a lint rule configured and no format block.
//  2. Run `ttsc fix` on one copy and `ttsc format` on the other.
//  3. Assert fix applied the lint fix but added no semicolons, while format added
//     the default semicolons but left the `var` lint violation untouched.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `fix` command and then the `format` command on separate copies of one source with only no-var configured and no format block; fix must yield `let` with all three semicolons still missing, format must add semicolons while keeping `var`.
// @evidence contracts/testing.md#independent-expectations Both complete files are compared against independently authored literals: fix changes only var to let, while format adds three semicolons and preserves var, the call and the export. Additional original line checks remain.
// @evidence contracts/testing.md#distinguishing-cases Contrasts two commands over identical input: fix applies lint edits but no default formatting, format applies default semicolons but no lint edit. Both exit 0 with empty output; configured-format-block fix is owned by the sibling fix test.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run twice (fix, format) against two temp-dir projects; no child process, built binary or installed consumer.
func TestCommandFixSkipsDefaultFormattingThatFormatApplies(t *testing.T) {
  const source = "var legacy = 1\nJSON.stringify(legacy)\nexport {}\n"

  fixRoot := seedLintProject(t, source)
  seedLintRules(t, fixRoot, map[string]string{"no-var": "error"})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "fix",
      "--cwd", fixRoot,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("fix mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  // no-var rewrote var to let; the default formatter never ran, so all three
  // missing semicolons stay, including export {}.
  assertFileText(
    t,
    filepath.Join(fixRoot, "src", "main.ts"),
    "let legacy = 1\nJSON.stringify(legacy)\nexport {}\n",
  )

  formatRoot := seedLintProject(t, source)
  seedLintRules(t, formatRoot, map[string]string{"no-var": "error"})
  code, stdout, stderr = captureCommandOutput(t, func() int {
    return run([]string{
      "format",
      "--cwd", formatRoot,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("format mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  // The default formatter added all three semicolons; format is write-only, so the
  // `no-var` lint violation is left in place (`var`, not `let`).
  got, err := os.ReadFile(filepath.Join(formatRoot, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  text := string(got)
  const formatWant = "var legacy = 1;\nJSON.stringify(legacy);\nexport {};\n"
  if text != formatWant {
    t.Fatalf("format changed unrelated source or omitted a terminator: got %q want %q", text, formatWant)
  }
  if !strings.Contains(text, "var legacy = 1;") {
    t.Fatalf("format must apply the default terminator and keep `var`: %q", text)
  }
  if !strings.Contains(text, "JSON.stringify(legacy);") {
    t.Fatalf("format must apply the trailing default terminator: %q", text)
  }
  if strings.Contains(text, "let ") {
    t.Fatalf("format is write-only and must not apply the no-var lint fix: %q", text)
  }
}
