package linthost

import "testing"

// TestFormatQuotesConvertsSingleToDouble verifies the required quote conversion.
//
// A plain hello string has zero required escapes with either delimiter.
// The default double preference must therefore change the single-quoted
// form while preserving its value, declaration and use.
//
// @evidence contracts/testing.md#behavioral-verification format/quotes must change the plain single-quoted hello to the default double-quoted spelling without changing its declaration or JSON.stringify call.
// @evidence contracts/testing.md#independent-expectations The complete output literal follows the preferred-double zero-escape tie policy and preserves the cooked hello payload and surrounding program bytes.
// @evidence contracts/testing.md#distinguishing-cases This zero-cost tie must change; TestFormatQuotesSkipsDoubleQuotedLiterals owns the already-preferred negative and escape-minimization cases own strict cost differences.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotesConvertsSingleToDouble is a public Go unit selected by TestSelectedLintUnits. This host owns its literal inputs and complete output assertions; the shared syntax-only harness invokes the owning rule and applies source edits in process without a consumer install, native product build or product host.
func TestFormatQuotesConvertsSingleToDouble(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/quotes",
    "const greeting = 'hello';\nJSON.stringify(greeting);\n",
    "const greeting = \"hello\";\nJSON.stringify(greeting);\n",
  )
}
