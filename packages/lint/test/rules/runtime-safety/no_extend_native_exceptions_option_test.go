package linthost

import "testing"

// TestNoExtendNativeExceptionsOption verifies the `exceptions` option removes
// a builtin from the protected set, mirroring ESLint's no-extend-native.
//
// With `String` excepted, extending `String.prototype` is allowed while every
// other native prototype (here `Array`) still reports. This pins the option
// plumbing end-to-end through the corpus resolver.
//
//  1. Supply `{ exceptions: ["String"] }` via the corpus options directive.
//  2. Run the engine on both an excepted and a non-excepted prototype write.
//  3. Assert only the non-excepted write reports.
//
// @evidence contracts/testing.md#behavioral-verification The actual corpus resolver must exempt String while still reporting Array under the original exceptions option.
// @evidence contracts/testing.md#independent-expectations The literal exceptions list independently permits String and leaves the protected Array policy intact; one authored annotation fixes the complete set.
// @evidence contracts/testing.md#distinguishing-cases Excepted and non-excepted prototype writes share one source; this detects ignored configuration and over-broad exemption.
// @evidence contracts/testing.md#execution-ownership TestNoExtendNativeExceptionsOption is selected in the shared Go unit population. It passes the authored no-extend-native-exceptions.ts fixture through assertRuleCorpusCase to the owning AST Engine. No consumer install, native artifact build or real product host runs.
func TestNoExtendNativeExceptionsOption(t *testing.T) {
  assertRuleCorpusCase(t, "no-extend-native-exceptions.ts", `// @ttsc-corpus-options: no-extend-native {"exceptions":["String"]}
// expect: no-extend-native error
Array.prototype.foo = 1;
String.prototype.bar = 1;
`)
}
