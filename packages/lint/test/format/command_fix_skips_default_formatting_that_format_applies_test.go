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
// keeps its missing semicolons — a pure lint pass. Running both commands on
// identical input and asserting the two outputs diverge locks that intentional
// asymmetry (fix.go's resolver choice) against a regression that silently routes
// fix through the default formatter.
//
//  1. Seed two copies of one source — a `no-var` lint violation plus two missing
//     semicolons — with only a lint rule configured and no `format` block.
//  2. Run `ttsc fix` on one copy and `ttsc format` on the other.
//  3. Assert fix applied the lint fix but added no semicolons, while format added
//     the default semicolons but left the `var` lint violation untouched.
func TestCommandFixSkipsDefaultFormattingThatFormatApplies(t *testing.T) {
  const source = "var legacy = 1\nJSON.stringify(legacy)\n"

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
  // no-var rewrote `var`→`let`; the default formatter never ran, so both
  // missing semicolons stay.
  assertFileText(
    t,
    filepath.Join(fixRoot, "src", "main.ts"),
    "let legacy = 1\nJSON.stringify(legacy)\n",
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
  // The default formatter added both semicolons; format is write-only, so the
  // `no-var` lint violation is left in place (`var`, not `let`).
  got, err := os.ReadFile(filepath.Join(formatRoot, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  text := string(got)
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
