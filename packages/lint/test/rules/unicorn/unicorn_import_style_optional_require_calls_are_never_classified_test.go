package linthost

import (
  "testing"
)

// TestUnicornImportStyleOptionalRequireCallsAreNeverClassified verifies
// that `require?.(…)` stays silent in both listener positions: the
// statement listener requires a non-optional call, and the declarator
// listener never fires because ESTree wraps optional calls in a
// ChainExpression, so upstream's `init.type === 'CallExpression'` check
// fails (verified against eslint-plugin-unicorn 71.1.0).
//
//  1. Run both optional-call shapes against the default `util` policy.
//  2. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification The engine accepts optional require in both statement and declarator positions.
// @evidence contracts/testing.md#independent-expectations The supported upstream optional-call/ChainExpression exclusion independently prevents either listener from classifying these calls.
// @evidence contracts/testing.md#distinguishing-cases Both retained optional shapes stay clean; direct nonoptional require violations belong to policy matrices.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleOptionalRequireCallsAreNeverClassified owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleOptionalRequireCallsAreNeverClassified(t *testing.T) {
  assertRuleSkipsSource(t, unicornImportStyleRuleName, `require?.("util");
const util = require?.("util");
void util;
`)
}
