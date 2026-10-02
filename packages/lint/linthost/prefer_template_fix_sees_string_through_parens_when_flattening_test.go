package linthost

import "testing"

// TestFixPreferTemplateSeesStringThroughParensWhenFlattening verifies
// parentheses are transparent to the flattening DECISION:
// `("a" + b) + c + " s"` → “ `${"" + (("a" + b))}${"" + (c)} s` “.
//
// The parenthesized operand itself stays one slot, but its string
// literal still marks the enclosing chain as string concatenation —
// `("a" + b)` evaluates to a string, so `+ c` appends and `c` can keep
// its own `${"" + (c)}` slot. Were the containment gate opaque to parens it
// would demote the whole left side to `${"" + (("a" + b) + c)}` — still
// value-correct, but a needless behavior regression from the pre-gate
// fixer and from upstream ESLint, which flattens here.
//
// 1. Snapshot a chain whose only string literal hides inside parens.
// 2. Apply `prefer-template` fix.
// 3. Assert `c` still flattens into its own slot.
//
// @evidence contracts/testing.md#behavioral-verification Recognizes a string-producing parenthesized operand while retaining that operand whole in a slot and flattening later c.
// Every dynamic slot explicitly retains default-hint concatenation coercion.
//
// @evidence contracts/testing.md#independent-expectations The authored (a-string+b) operand already yields a string, but explicit grouping remains; literal nested slot then c preserves evaluation.
// @evidence contracts/testing.md#distinguishing-cases Contrasts grouped arithmetic subchains, which do not establish string mode until the suffix.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot, applies the rule's actual edits to the fixture and compares complete independently authored output. This Test entry owns this exact source/output pair. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestFixPreferTemplateSeesStringThroughParensWhenFlattening(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const b: any = 1;\nconst c: any = 2;\nconst s = (\"a\" + b) + c + \" s\";\nJSON.stringify(s);\n",
    "const b: any = 1;\nconst c: any = 2;\nconst s = `${\"\" + ((\"a\" + b))}${\"\" + (c)} s`;\nJSON.stringify(s);\n",
  )
}
