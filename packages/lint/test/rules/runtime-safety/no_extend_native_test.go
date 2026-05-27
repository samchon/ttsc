package linthost

import "testing"

// TestRuleCorpusNoExtendNative verifies the lint rule corpus fixture no-extend-native.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. The fixture
// pairs two prototype-mutation assignments — one numeric, one function — with a static
// assignment to `Object.foo` that must stay quiet because it doesn't touch `.prototype.<key>`.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoExtendNative(t *testing.T) {
  assertRuleCorpusCase(t, "no-extend-native.ts", "// expect: no-extend-native error\nArray.prototype.foo = 1;\n// expect: no-extend-native error\nString.prototype.upper = function (): void {};\nObject.foo = 1;\n")
}
