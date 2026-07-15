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
func TestNoExtendNativeExceptionsOption(t *testing.T) {
  assertRuleCorpusCase(t, "no-extend-native-exceptions.ts", `// @ttsc-corpus-options: no-extend-native {"exceptions":["String"]}
// expect: no-extend-native error
Array.prototype.foo = 1;
String.prototype.bar = 1;
`)
}
