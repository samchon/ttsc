package linthost

import "testing"

// TestFormatQuotePropsUnquotesProtoKeyWithoutChangingSetterSemantics verifies quote removal preserves the key kind.
//
// Quoted and bare noncomputed __proto__ property definitions both use the
// ECMAScript prototype-setter semantics. Removing the quotes must retain
// that behavior; computed ["__proto__"] remains an ordinary own property.
//
// @evidence contracts/testing.md#behavioral-verification format/quote-props as-needed must unquote the noncomputed __proto__ key without rewriting its computed counterpart or changing either value.
// @evidence contracts/testing.md#independent-expectations The complete literal outputs change only supported quoteProps spellings; independently checked Prettier 3.8.3 agrees on those key spellings. ECMAScript PropertyDefinitionEvaluation treats noncomputed __proto__ as a setter regardless of quotes, while a computed key is ordinary; the outputs retain that distinction and the null values.
// @evidence contracts/testing.md#distinguishing-cases The original numeric-value fixture remains with its corrected specification-based output. The added null-valued setter and adjacent computed-key fixture require both eligible quotes to change while computed syntax remains intact. Added class method, interface and type-literal holders require the same static name eligibility without changing their bodies or number types.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotePropsUnquotesProtoKeyWithoutChangingSetterSemantics is a public Go unit selected by TestSelectedLintUnits. This host owns all five complete source fixtures and literal output comparisons; the shared syntax-only harness invokes the rule and applies edits in the same process without a consumer install, native product build or product host.
func TestFormatQuotePropsUnquotesProtoKeyWithoutChangingSetterSemantics(t *testing.T) {
  assertFixSnapshotWithOptions(t, "format/quote-props", "const a = { \"__proto__\": 1, \"foo\": 2 };\n", `{"mode":"as-needed"}`, "const a = { __proto__: 1, foo: 2 };\n")
  assertFixSnapshotWithOptions(t, "format/quote-props", "const obj = { \"__proto__\": null, [\"__proto__\"]: null, \"foo\": 2 };\n", `{"mode":"as-needed"}`, "const obj = { __proto__: null, [\"__proto__\"]: null, foo: 2 };\n")
  assertFixSnapshotWithOptions(t, "format/quote-props", "class C { \"__proto__\"() {} }\n", `{"mode":"as-needed"}`, "class C { __proto__() {} }\n")
  assertFixSnapshotWithOptions(t, "format/quote-props", "interface Shape { \"__proto__\": number }\n", `{"mode":"as-needed"}`, "interface Shape { __proto__: number }\n")
  assertFixSnapshotWithOptions(t, "format/quote-props", "type Shape = { \"__proto__\": number };\n", `{"mode":"as-needed"}`, "type Shape = { __proto__: number };\n")
}
