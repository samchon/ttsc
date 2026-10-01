package linthost

import "testing"

// TestFixObjectShorthandPreservesThePrototypeSetter verifies the special colon property stays intact.
//
// A colon-form __proto__ property sets the prototype rather than creating an own
// property. Shorthand would change both inheritance and property enumeration.
//
// 1. Check ordinary, escaped, quoted and computed prototype property names.
// 2. Require no shorthand diagnostic for the prototype setter.
// 3. Keep the ordinary identifier shorthand transformation available.
//
// @evidence contracts/testing.md#behavioral-verification The real rule skips prototype setters and the disk fixer still rewrites ordinary a:a.
// @evidence contracts/testing.md#independent-expectations ECMAScript gives colon-form __proto__ prototype-setter semantics, whereas shorthand creates an own property.
// @evidence contracts/testing.md#distinguishing-cases Plain and escaped setters complement quoted/computed names and an ordinary shorthand positive.
// @evidence contracts/testing.md#execution-ownership This source unit invokes Engine findings and the in-process disk fixer without a native producer.
func TestFixObjectShorthandPreservesThePrototypeSetter(t *testing.T) {
  for _, source := range []string{
    "const o = {__proto__: __proto__};",
    "const o = {__pr\\u006fto__: __proto__};",
    "const o = {'__proto__': __proto__};",
    "const o = {['__proto__']: __proto__};",
  } {
    t.Run(source, func(t *testing.T) { assertRuleSkipsSource(t, "object-shorthand", source) })
  }
  assertFixSnapshot(t, "object-shorthand", "const o = {a: a};", "const o = {a};")
}
