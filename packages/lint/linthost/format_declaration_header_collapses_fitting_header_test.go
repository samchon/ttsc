package linthost

import "testing"

// TestFormatDeclarationHeaderCollapsesFittingHeader verifies a header
// broken across lines but short enough to fit is collapsed back to one
// line, matching Prettier.
//
// The rule reconstructs the header canonically: when the flat form fits
// printWidth it is the target, so a needlessly multi-line header is
// rejoined.
//
//  1. Parse an interface with a needlessly broken short header.
//  2. Apply format/declaration-header at printWidth 80.
//  3. Assert the header collapses onto one line.
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must collapse an unnecessarily split fitting extends header while leaving its a:number member body intact.
// @evidence contracts/testing.md#independent-expectations The literal full output specifies the width-eighty flat-header preference independently; F, base A and the member annotation remain identical.
// @evidence contracts/testing.md#distinguishing-cases The changed short multiline header contrasts with genuinely oversized break/explosion cases and canonical broken-header no-op cases.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderCollapsesFittingHeader is a public Go unit selected by the lint semantic-unit Evidence claim. Its shared syntax-only harness invokes the owning formatter on temporary fixture source and applies its reported edits for exact output assertions in the same process, without a consumer install, native product build or host execution.
func TestFormatDeclarationHeaderCollapsesFittingHeader(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "interface F\n  extends A {\n  a: number;\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
    "interface F extends A {\n  a: number;\n}\n",
  )
}
