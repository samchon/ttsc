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
func TestFormatPrintWidthHugsFirstCallbackArgument(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "onUnmounted(() => { cleanupTheThing(); resetAll(); }, target);\n",
    `{"printWidth":40,"tabWidth":2}`,
    "onUnmounted(() => {\n  cleanupTheThing();\n  resetAll();\n}, target);\n",
  )
}
