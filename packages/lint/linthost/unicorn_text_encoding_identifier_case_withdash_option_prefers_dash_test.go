package linthost

import (
  "encoding/json"
  "testing"
)

// TestUnicornTextEncodingIdentifierCaseWithDashOptionPrefersDash verifies the
// `{ withDash: true }` option flips the canonical form to the dashed `utf-8`
// everywhere, so `"utf8"` becomes the violation and `"utf-8"` becomes valid —
// the exact inverse of the default configuration.
//
// The option is the global override of the per-context dash rule; a project that
// prefers WHATWG spelling turns it on and every position, not just
// `TextDecoder`/charset, is held to `utf-8`. `ascii` is unaffected because it has
// no dashed variant.
//
//  1. Configure the rule with { withDash: true }.
//  2. Assert `"utf8"` reports a suggestion rewriting to `utf-8`.
//  3. Assert `"utf-8"` (now canonical) reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification runRuleFindingsSnapshot verifies one exact message and utf-8 suggestion edit under withDash:true, and the option-aware skip helper accepts utf-8.
// @evidence contracts/testing.md#independent-expectations The literal message, suggestion replacement and zero control encode the supported explicit dash override independently of implementation.
// @evidence contracts/testing.md#distinguishing-cases The same options reject utf8 and accept utf-8; the default inverse policy is covered by TestRuleCorpusUnicornTextEncodingIdentifierCase.
// @evidence contracts/testing.md#execution-ownership TestUnicornTextEncodingIdentifierCaseWithDashOptionPrefersDash is a discoverable Go unit host; its source/option fixtures exercise owning AST engine and fix operations in the shared Go process without consumer installation, native builds or product child hosts. Helper failures retain the source/expected fixture identity.
func TestUnicornTextEncodingIdentifierCaseWithDashOptionPrefersDash(t *testing.T) {
  options := json.RawMessage(`{"withDash":true}`)

  _, _, findings := runRuleFindingsSnapshot(
    t,
    unicornTextEncodingIdentifierCaseRuleName,
    "const enc = \"utf8\";\nvoid enc;\n",
    options,
  )
  if len(findings) != 1 {
    t.Fatalf("want 1 finding, got %d (%+v)", len(findings), findings)
  }
  if findings[0].Message != "Prefer `utf-8` over `utf8`." {
    t.Fatalf("message got %q", findings[0].Message)
  }
  if len(findings[0].Suggestions) != 1 || len(findings[0].Suggestions[0].Edits) != 1 ||
    findings[0].Suggestions[0].Edits[0].Text != "utf-8" {
    t.Fatalf("want one suggestion rewriting to `utf-8`, got %+v", findings[0].Suggestions)
  }

  assertRuleSkipsSourceWithOptions(
    t,
    unicornTextEncodingIdentifierCaseRuleName,
    "const enc = \"utf-8\";\nvoid enc;\n",
    `{"withDash":true}`,
  )
}
