package linthost

import "testing"

// TestFixNoExtraBooleanCastCollapsesNestedBooleanCall verifies the
// `if (Boolean(Boolean(x)))` → `if (Boolean(x))` rewrite — one cascade pass
// over a nested redundant cast.
//
// Both calls qualify: the outer call is an if condition and the inner call
// is a Boolean argument. Their edits overlap, so the applier selects only one
// group in this pass; the fix cascade can remove the remaining wrapper later.
// The expected bytes retain one bare Boolean(x) call without extra parentheses;
// they do not identify which equivalent wrapper supplied the retained text.
//
// 1. Snapshot `if (Boolean(Boolean(x)))` source.
// 2. Apply one `no-extra-boolean-cast` fix pass.
// 3. Assert the outer cast collapses to `if (Boolean(x))` without parens.
//
// @evidence contracts/testing.md#behavioral-verification One automatic fix pass removes one nested Boolean wrapper and leaves exactly one Boolean(x) call.
// @evidence contracts/testing.md#independent-expectations The literal expected Boolean(x) pins one-layer collapse rather than unchanged nesting or complete removal, without inferring retained wrapper identity from equal text.
// @evidence contracts/testing.md#distinguishing-cases Nested wrappers pin the one-pass edit surface; the simple Boolean-in-if unit owns direct unwrapping.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot and applies the actual no-extra-boolean-cast edits to the fixture. This Test owns the exact independently authored source/output pair, including text outside the replacement. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestFixNoExtraBooleanCastCollapsesNestedBooleanCall(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(x: any) {\n  if (Boolean(Boolean(x))) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
    "function f(x: any) {\n  if (Boolean(x)) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
  )
}
