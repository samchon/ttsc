package linthost

import "testing"

// TestNoFallthroughInvalidCommentPatternFallsBackToDefault verifies an uncompilable commentPattern degrades to the default marker.
//
// ESLint throws at rule creation on a bad regex. This rule's documented
// invalid-pattern policy retains the default marker pattern as a fallback,
// rather than silently disabling
// marker recognition (which would flood marked code with false positives).
//
// 1. Mark the transition with the standard `// falls through`.
// 2. Run the engine with the invalid options {"commentPattern":"("}.
// 3. Assert zero findings (default pattern still honored).
//
// @evidence contracts/testing.md#behavioral-verification No finding reports for a default marker when configured regex is malformed.
// @evidence contracts/testing.md#independent-expectations The supported host policy explicitly falls back to the default pattern for an invalid regex; this does not certify upstream rule-creation error equivalence.
// @evidence contracts/testing.md#distinguishing-cases CustomPatternReplacesDefaultMarker retains valid custom-pattern replacement and rejects default text.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughInvalidCommentPatternFallsBackToDefault is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughInvalidCommentPatternFallsBackToDefault(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    // falls through
  case 1:
    console.log(1);
    break;
}
`, `{"commentPattern":"("}`)
}
