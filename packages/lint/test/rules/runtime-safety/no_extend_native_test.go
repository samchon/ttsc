package linthost

import "testing"

// TestRuleCorpusNoExtendNative verifies the lint rule corpus fixture no-extend-native.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. The fixture
// exercises all four prototype-extension shapes — dotted and computed member assignment plus
// `Object.defineProperty` / `Object.defineProperties` on a native prototype — against a static
// assignment to `Object.foo` that must stay quiet because it doesn't touch a `.prototype`. The
// source below is byte-identical to tests/test-lint/src/cases/no-extend-native.ts, which the
// TypeScript corpus runner drives through the real ttsc command path.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoExtendNative(t *testing.T) {
  assertRuleCorpusCase(t, "no-extend-native.ts", `// expect: no-extend-native error
Array.prototype.foo = 1;
// expect: no-extend-native error
String.prototype.upper = function (): void {};
// expect: no-extend-native error
Array.prototype["baz"] = 2;
// expect: no-extend-native error
Object.defineProperty(Number.prototype, "half", { value: 3 });
// expect: no-extend-native error
Object.defineProperties(Boolean.prototype, { flip: { value: 4 } });
Object.foo = 1;
`)
}
