package linthost

import "testing"

// TestFixSecurityDetectNewBufferOffersThreeSuccessors verifies
// `security/detect-new-buffer` offers the three APIs that replaced the
// deprecated constructor and imposes none of them.
//
// `new Buffer(x)` was split by argument type: `Buffer.from` for a string,
// array, or buffer, `Buffer.alloc` for a zero-filled size, `Buffer.allocUnsafe`
// for an uninitialized one. This rule fires only when the argument is not a
// literal, so the source cannot say which applies, and imposing one would
// select an incompatible API or allocation policy. Buffer.allocUnsafe requires
// a numeric size and throws for a string; a valid size can expose uninitialized
// memory unless the caller initializes it. This test checks edits, not allocation.
//
//  1. Report `new Buffer(input)` and assert three suggestions, each removing
//     `new`, rewriting the callee, and leaving the argument list intact.
//  2. Assert no automatic edit is applied, so `ttsc fix` leaves the call.
//  3. Assert a comment between `new` and `Buffer` survives every suggestion.
//  4. Assert the negative twins stay silent: a literal argument, which the
//     rule exempts, and a different constructor.
//
// @evidence contracts/testing.md#behavioral-verification The Buffer rule offers exactly from/alloc/allocUnsafe suggestions and no autofix, preserving arguments and intervening comments.
// @evidence contracts/testing.md#independent-expectations Three literal titles/results require each API and its two edits; separately authored commented results retain the user-choice prose.
// @evidence contracts/testing.md#distinguishing-cases Unknown argument needs alternatives; literal input and Uint8Array construction stay silent, while the automatic pass leaves original bytes unchanged.
// @evidence contracts/testing.md#execution-ownership TestFixSecurityDetectNewBufferOffersThreeSuccessors owns every suggestion row and comment row via runRuleFindingsSnapshot/applyFindingFixesToText in process.
func TestFixSecurityDetectNewBufferOffersThreeSuccessors(t *testing.T) {
  source := "const buffer = new Buffer(input);\nconsole.log(buffer);\n"
  _, _, findings := runRuleFindingsSnapshot(t, "security/detect-new-buffer", source, nil)
  if len(findings) != 1 {
    t.Fatalf("findings = %d, want 1 (%+v)", len(findings), findings)
  }
  finding := findings[0]
  if len(finding.Fix) != 0 {
    t.Fatalf("automatic fixes = %d, want 0", len(finding.Fix))
  }
  expected := []struct {
    title  string
    result string
  }{
    {"Replace with `Buffer.from`.", "const buffer = Buffer.from(input);\nconsole.log(buffer);\n"},
    {"Replace with `Buffer.alloc`.", "const buffer = Buffer.alloc(input);\nconsole.log(buffer);\n"},
    {
      "Replace with `Buffer.allocUnsafe`.",
      "const buffer = Buffer.allocUnsafe(input);\nconsole.log(buffer);\n",
    },
  }
  if len(finding.Suggestions) != len(expected) {
    t.Fatalf("suggestions = %+v, want %d", finding.Suggestions, len(expected))
  }
  for index, want := range expected {
    suggestion := finding.Suggestions[index]
    if suggestion.Title != want.title {
      t.Fatalf("suggestion %d title = %q, want %q", index, suggestion.Title, want.title)
    }
    rewritten, applied := applyFindingFixesToText(source, []*Finding{{Fix: suggestion.Edits}})
    if applied != 2 || rewritten != want.result {
      t.Fatalf("suggestion %d: applied=%d\nwant %q\ngot  %q", index, applied, want.result, rewritten)
    }
  }
  automatic, applied := applyFindingFixesToText(source, findings)
  if applied != 0 || automatic != source {
    t.Fatalf("automatic edits changed source: applied=%d source=%q", applied, automatic)
  }

  commented := "const buffer = new /* user chooses the allocation */ Buffer(input);\nconsole.log(buffer);\n"
  _, _, commentedFindings := runRuleFindingsSnapshot(t, "security/detect-new-buffer", commented, nil)
  if len(commentedFindings) != 1 || len(commentedFindings[0].Suggestions) != len(expected) {
    t.Fatalf("commented suggestions = %+v", commentedFindings)
  }
  for index, want := range []string{
    "const buffer = /* user chooses the allocation */ Buffer.from(input);\nconsole.log(buffer);\n",
    "const buffer = /* user chooses the allocation */ Buffer.alloc(input);\nconsole.log(buffer);\n",
    "const buffer = /* user chooses the allocation */ Buffer.allocUnsafe(input);\nconsole.log(buffer);\n",
  } {
    rewritten, applied := applyFindingFixesToText(commented, []*Finding{{Fix: commentedFindings[0].Suggestions[index].Edits}})
    if applied != 2 || rewritten != want {
      t.Fatalf("commented suggestion %d: applied=%d\nwant %q\ngot  %q", index, applied, want, rewritten)
    }
  }

  assertRuleSkipsSource(
    t,
    "security/detect-new-buffer",
    "const buffer = new Buffer(\"safe\");\nconsole.log(buffer);\n",
  )
  assertRuleSkipsSource(
    t,
    "security/detect-new-buffer",
    "const bytes = new Uint8Array(input);\nconsole.log(bytes);\n",
  )
}
