package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestUnicornStringContentReportsAndFixesPlainStringLiteral verifies the
// core happy path: a configured pattern rewrites a plain string literal.
//
// The rule has no default patterns, so this pins the whole configured
// pipeline at once: options decode, cooked-value matching, the upstream
// default message with `{{match}}`/`{{suggest}}` interpolation, the exact
// whole-literal diagnostic range, the re-quoted fix text, and idempotence of
// the fixed output (the canonical result must not re-fire).
//
//  1. Configure `patterns: {no: "yes"}` and lint `const foo = 'no';`.
//  2. Assert one finding with the interpolated default message covering the
//     complete literal including quotes, carrying one whole-literal edit.
//  3. Apply the fix, compare the rewritten source, and assert the fixed
//     source produces zero findings under the same options.
func TestUnicornStringContentReportsAndFixesPlainStringLiteral(t *testing.T) {
  source := "const foo = 'no';\n"
  options := `{"patterns":{"no":"yes"}}`

  _, _, findings := runRuleFindingsSnapshot(t, "unicorn/string-content", source, json.RawMessage(options))
  if len(findings) != 1 {
    t.Fatalf("want one finding, got %d (%+v)", len(findings), findings)
  }
  finding := findings[0]
  if finding.Message != "Prefer `yes` over `no`." {
    t.Fatalf("message: want the interpolated upstream default, got %q", finding.Message)
  }
  wantPos := strings.Index(source, "'no'")
  if finding.Pos != wantPos || finding.End != wantPos+len("'no'") {
    t.Fatalf("range: want [%d,%d), got [%d,%d)", wantPos, wantPos+len("'no'"), finding.Pos, finding.End)
  }
  if len(finding.Fix) != 1 || finding.Fix[0].Text != "'yes'" {
    t.Fatalf("fix: want one whole-literal edit to 'yes', got %+v", finding.Fix)
  }
  if len(finding.Suggestions) != 0 {
    t.Fatalf("autofixable finding must not carry suggestions, got %+v", finding.Suggestions)
  }

  expected := "const foo = 'yes';\n"
  assertFixSnapshotWithOptions(t, "unicorn/string-content", source, options, expected)
  assertRuleSkipsSourceWithOptions(t, "unicorn/string-content", expected, options)
}
