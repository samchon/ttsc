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
//
// @evidence contracts/testing.md#behavioral-verification runRuleFindingsSnapshot compares exact configured and interpolated messages, detecting ignored custom text or accidental removal of unknown placeholders.
// @evidence contracts/testing.md#independent-expectations The public custom-message contract and ESLint message interpolation establish the authored bar/foo text and preserved other placeholder.
// @evidence contracts/testing.md#distinguishing-cases A plain message and one containing spaced known and unknown placeholders exercise distinct paths; the default message is covered by ReportsAndFixesPlainStringLiteral.
// @evidence contracts/testing.md#execution-ownership TestUnicornStringContentHonorsCustomMessageAndPlaceholders is the owning discoverable Go unit entry; its explicit variants and named t.Run cases preserve failure identity while the lint engine parses and checks authored sources in one Go process. Fixture files use t.TempDir; no installed consumer, native build or product child host runs.
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
