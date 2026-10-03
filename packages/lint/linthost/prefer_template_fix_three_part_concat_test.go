package linthost

import "testing"

// TestFixPreferTemplateRewritesThreePartConcatChain verifies the
// canonical `"hi " + name + "!"` → “ `hi ${"" + (name)}!` “ rewrite.
//
// Detection fires only on the topmost `+` chain, so the fixer must
// flatten the whole chain in one pass; otherwise a partial rewrite
// would leave nested template literals or stranded `+` operators. This
// snapshot requires the complete three-operand rewrite in one application;
// it does not execute fixture benchmarks or a convergence loop.
//
// 1. Snapshot a 3-part concat (`"hi " + name + "!"`).
// 2. Apply `prefer-template` fix.
// 3. Assert the result is the canonical template literal.
//
// @evidence contracts/testing.md#behavioral-verification Fixes greeting plus name plus punctuation to one template while retaining declarations and use.
// Every dynamic slot explicitly retains default-hint concatenation coercion.
//
// @evidence contracts/testing.md#independent-expectations The literal expected hi/name/exclamation output follows concatenation value and evaluation order independently.
// @evidence contracts/testing.md#distinguishing-cases Prefix, dynamic middle and suffix preserve all three operands, complementing minimal and delimiter boundary cases.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot, applies the rule's actual edits to the fixture and compares complete independently authored output. This Test entry owns this exact source/output pair. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestFixPreferTemplateRewritesThreePartConcatChain(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const name = \"world\";\nconst s = \"hi \" + name + \"!\";\nJSON.stringify(s);\n",
    "const name = \"world\";\nconst s = `hi ${\"\" + (name)}!`;\nJSON.stringify(s);\n",
  )
}
