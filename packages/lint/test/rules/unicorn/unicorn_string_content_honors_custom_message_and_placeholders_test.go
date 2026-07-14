package linthost

import (
  "encoding/json"
  "testing"
)

// TestUnicornStringContentHonorsCustomMessageAndPlaceholders verifies the
// per-pattern `message` option replaces the default diagnostic text.
//
// ESLint interpolates `{{match}}` / `{{suggest}}` data into whatever message
// a pattern supplies, so a custom message must be used verbatim, its known
// placeholders substituted, and unknown placeholders left untouched rather
// than erased. The diagnostic text is the rule's whole user contract, so it
// is compared exactly.
//
//  1. Lint `const foo = "foo";` under a plain custom message and assert the
//     exact upstream text.
//  2. Lint the same source under a message carrying both known and unknown
//     placeholders.
//  3. Assert known terms interpolate and the unknown `{{other}}` survives.
func TestUnicornStringContentHonorsCustomMessageAndPlaceholders(t *testing.T) {
  source := `const foo = "foo";` + "\n"

  plain := `{"patterns":{"foo":{"suggest":"bar","message":"` + "`bar` is better than `foo`." + `"}}}`
  _, _, findings := runRuleFindingsSnapshot(t, "unicorn/string-content", source, json.RawMessage(plain))
  if len(findings) != 1 || findings[0].Message != "`bar` is better than `foo`." {
    t.Fatalf("custom message: want the exact configured text, got %+v", findings)
  }

  placeholders := `{"patterns":{"foo":{"suggest":"bar","message":"Swap {{ match }} for {{suggest}} ({{other}})."}}}`
  _, _, findings = runRuleFindingsSnapshot(t, "unicorn/string-content", source, json.RawMessage(placeholders))
  if len(findings) != 1 || findings[0].Message != "Swap foo for bar ({{other}})." {
    t.Fatalf("placeholder message: want interpolation of known terms only, got %+v", findings)
  }
}
