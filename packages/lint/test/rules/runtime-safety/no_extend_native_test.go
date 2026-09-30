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
//
// @evidence contracts/testing.md#behavioral-verification Engine compares all five annotated native prototype writes while leaving Object.foo clean.
// @evidence contracts/testing.md#independent-expectations Authored annotations identify mutation of built-in prototypes through direct/computed assignment and defineProperty APIs; static Object.foo does not extend a prototype.
// @evidence contracts/testing.md#distinguishing-cases Array, String, Number and Boolean prototype mutations report across the original shapes; a static native property remains clean. The option test owns excepted prototypes.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoExtendNative is selected in the shared Go unit population. It passes the authored no-extend-native.ts fixture through assertRuleCorpusCase to the owning AST Engine. No consumer install, native artifact build or real product host runs.
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
