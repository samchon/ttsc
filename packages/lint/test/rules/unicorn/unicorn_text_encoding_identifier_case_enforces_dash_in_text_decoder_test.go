package linthost

import "testing"

// TestUnicornTextEncodingIdentifierCaseEnforcesDashInTextDecoder verifies the
// first argument of `new TextDecoder(...)` demands the dashed `utf-8` spelling
// even though the default canonical form is `utf8`.
//
// `TextDecoder` echoes the WHATWG label back, so `new TextDecoder("utf8")` is
// flagged toward `utf-8` — the inverse of the default — while
// `new TextDecoder("utf-8")` is already canonical and stays silent. The report
// is a suggestion, not an autofix, because the constructor is not the
// `fs.readFile` position.
//
//  1. Construct a TextDecoder with a non-canonical (for this context) encoding.
//  2. Assert one finding whose suggestion rewrites toward the dashed form.
//  3. Assert the already-dashed spelling reports nothing.
func TestUnicornTextEncodingIdentifierCaseEnforcesDashInTextDecoder(t *testing.T) {
  for _, source := range []string{
    "const dec = new TextDecoder(\"utf8\");\nvoid dec;\n",
    "const dec = new TextDecoder(\"UTF-8\");\nvoid dec;\n",
  } {
    _, _, findings := runRuleFindingsSnapshot(t, unicornTextEncodingIdentifierCaseRuleName, source, nil)
    if len(findings) != 1 {
      t.Fatalf("%q: want 1 finding, got %d (%+v)", source, len(findings), findings)
    }
    finding := findings[0]
    if len(finding.Fix) != 0 {
      t.Fatalf("%q: want a suggestion, not an autofix, got %+v", source, finding.Fix)
    }
    if len(finding.Suggestions) != 1 || len(finding.Suggestions[0].Edits) != 1 ||
      finding.Suggestions[0].Edits[0].Text != "utf-8" {
      t.Fatalf("%q: want one suggestion rewriting to `utf-8`, got %+v", source, finding.Suggestions)
    }
  }

  assertRuleSkipsSource(
    t,
    unicornTextEncodingIdentifierCaseRuleName,
    "const dec = new TextDecoder(\"utf-8\");\nvoid dec;\n",
  )
}
