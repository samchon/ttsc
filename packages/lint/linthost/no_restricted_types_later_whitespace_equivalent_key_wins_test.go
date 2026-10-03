package linthost

import (
  "testing"
  "encoding/json"
  "strings"
)

// TestNoRestrictedTypesLaterWhitespaceEquivalentKeyWins verifies the later of
// two whitespace-equivalent keys wins.
//
// Keys that differ only in spacing normalize to one policy and the final entry
// decides.
//
//  1. Configure Banned twice with differing outer or inner spacing, enabled then disabled and
//     the reverse.
//  2. Run the rule over a Banned type.
//  3. Assert the final disable is clean and the final enable reports one exact-span
//     error.
//
// @evidence contracts/testing.md#behavioral-verification Whitespace-normalized duplicate keys must retain the final policy.
// @evidence contracts/testing.md#independent-expectations The same authored Banned type must be clean for final disable and yield one exact-span rule error for final enable.
// @evidence contracts/testing.md#distinguishing-cases Reversed enabled/disabled order and spaces inside the equivalent key distinguish precedence from normalization.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedTypesLaterWhitespaceEquivalentKeyWins invokes the registered rule over an in-process parsed source through runRuleFindingsSnapshot; no native plugin build, compiler child or installation is involved.
func TestNoRestrictedTypesLaterWhitespaceEquivalentKeyWins(t *testing.T) {
  source := "type Value = Banned;\n"
  disabledLast := json.RawMessage(`{"types":{" Banned ":true,"Banned":false}}`)
  if findings := runNoRestrictedTypes(t, source, disabledLast); len(findings) != 0 {
    t.Fatalf("later disabled key did not win: %+v", findings)
  }
  enabledLast := json.RawMessage(`{"types":{"Banned":false," B a n n e d ":true}}`)
  findings := runNoRestrictedTypes(t, source, enabledLast)
  if len(findings) != 1 || findings[0].Message != "Don't use `Banned` as a type." {
    t.Fatalf("later enabled key did not win: %+v", findings)
  }
  start := strings.Index(source, "Banned")
  if findings[0].Rule != noRestrictedTypesRuleName || findings[0].Severity != SeverityError || findings[0].Pos != start || findings[0].End != start+len("Banned") { t.Fatalf("normalized policy finding = %+v", findings[0]) }
}
