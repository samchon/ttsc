package linthost

import "testing"

// TestFormatQuotePropsConsistentUnquotesProtoWithIdentifierKeys verifies quote removal preserves the key kind.
//
// The identifier-shaped __proto__ key does not force an object key group
// to remain quoted. Both noncomputed spellings retain setter semantics,
// while the computed spelling must remain an ordinary property.
//
// @evidence contracts/testing.md#behavioral-verification format/quote-props consistent mode must unquote both __proto__ and foo when their object group contains only removable static identifier keys.
// @evidence contracts/testing.md#independent-expectations Complete literal outputs preserve each holder and its contents while changing only key quotes; independently checked Prettier 3.8.3 agrees on those key spellings. ECMAScript PropertyDefinitionEvaluation assigns the same setter semantics to quoted and bare noncomputed __proto__, so removing these quotes preserves meaning and property values.
// @evidence contracts/testing.md#distinguishing-cases The original two-key numeric fixture retains its input with a corrected output. The added null-valued setter plus computed key keeps the computed property unchanged; the mixed bar-baz group separately owns consistent add-quote behavior. Added class method, interface and type-literal cases ensure their non-object holders also remove the redundant quotes without changing bodies or number types.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotePropsConsistentUnquotesProtoWithIdentifierKeys is a public Go unit selected by TestSelectedLintUnits. This host owns all five complete source fixtures and literal output comparisons; the shared syntax-only harness invokes the rule and applies edits in the same process without a consumer install, native product build or product host.
func TestFormatQuotePropsConsistentUnquotesProtoWithIdentifierKeys(t *testing.T) {
  assertFixSnapshotWithOptions(t, "format/quote-props", "const c = { \"__proto__\": 1, \"foo\": 2 };\n", `{"mode":"consistent"}`, "const c = { __proto__: 1, foo: 2 };\n")
  assertFixSnapshotWithOptions(t, "format/quote-props", "const obj = { \"__proto__\": null, [\"__proto__\"]: null, \"foo\": 2 };\n", `{"mode":"consistent"}`, "const obj = { __proto__: null, [\"__proto__\"]: null, foo: 2 };\n")
  assertFixSnapshotWithOptions(t, "format/quote-props", "class C { \"__proto__\"() {} }\n", `{"mode":"consistent"}`, "class C { __proto__() {} }\n")
  assertFixSnapshotWithOptions(t, "format/quote-props", "interface Shape { \"__proto__\": number }\n", `{"mode":"consistent"}`, "interface Shape { __proto__: number }\n")
  assertFixSnapshotWithOptions(t, "format/quote-props", "type Shape = { \"__proto__\": number };\n", `{"mode":"consistent"}`, "type Shape = { __proto__: number };\n")
}
