package linthost

import "testing"

// TestFormatPrintWidthHugsFirstCallbackArgument verifies Prettier's
// first-argument hugging: `foo(() => { … }, target)` keeps the callback
// attached to the open paren and flows `, target)` after its closing
// brace, instead of exploding both arguments onto their own lines.
//
// The old printer only hugged the LAST argument, so a leading callback
// with a trailing simple argument over-expanded. shouldHugFirstArgument
// pins the two-argument callback+simple shape (vue onUnmounted, rxjs
// schedule).
//
//  1. Parse an over-width call whose first arg is a block callback and
//     second is a plain identifier (printWidth 40).
//  2. Apply format/print-width.
//  3. Assert the callback hugs the parens and `, target)` trails.
//
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the hugs first callback argument fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert the callback hugs the parens and `, target)` trails.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Parse an over-width call whose first arg is a block callback and second is a plain identifier (printWidth 40). The asserted decision is: Assert the callback hugs the parens and `, target)` trails. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthHugsFirstCallbackArgument is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthHugsFirstCallbackArgument(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "onUnmounted(() => { cleanupTheThing(); resetAll(); }, target);\n",
    `{"printWidth":40,"tabWidth":2}`,
    "onUnmounted(() => {\n  cleanupTheThing();\n  resetAll();\n}, target);\n",
  )
}
