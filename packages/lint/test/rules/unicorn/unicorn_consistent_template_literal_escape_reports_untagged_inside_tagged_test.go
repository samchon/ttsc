package linthost

import (
  "strings"
  "testing"
)

// TestUnicornConsistentTemplateLiteralEscapeReportsUntaggedInsideTagged
// verifies the tagged-template guard stops at the tagged quasi and does
// not shadow nested untagged templates.
//
// Upstream's isTaggedTemplateLiteral answers for the template literal
// itself, so an untagged template nested inside a tagged template's
// substitution still reports, while every element of the tagged outer
// template (including one carrying a bad escape) stays silent. A guard
// implemented as "any tagged ancestor" would silently drop the inner
// finding.
//
//  1. Nest an untagged `$\{a}` template inside a tagged template whose
//     own tail also spells `$\{skipped}`.
//  2. Assert exactly one finding, anchored on the inner template's token.
//  3. Fix and assert only the inner payload was rewritten.
func TestUnicornConsistentTemplateLiteralEscapeReportsUntaggedInsideTagged(t *testing.T) {
  source := "const foo = html`${`$\\{a}`} and $\\{skipped}`;\n"
  expected := "const foo = html`${`\\${a}`} and $\\{skipped}`;\n"

  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentTemplateLiteralEscapeRuleName, source, nil)
  if len(findings) != 1 {
    t.Fatalf("want exactly the inner-template finding, got %d (%+v)", len(findings), findings)
  }
  marker := "`$\\{a}`"
  start := strings.Index(source, marker)
  if findings[0].Pos != start || findings[0].End != start+len(marker) {
    t.Fatalf("finding range: want [%d,%d), got [%d,%d)", start, start+len(marker), findings[0].Pos, findings[0].End)
  }

  assertFixSnapshot(t, unicornConsistentTemplateLiteralEscapeRuleName, source, expected)
}
