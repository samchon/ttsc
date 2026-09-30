package linthost

import "testing"

// TestFixPreferTemplateRendersEmptyStringOperandAsBarePlaceholder
// verifies the empty-literal boundary: `"" + a` → “ `${a}` “.
//
// The empty string contributes zero cooked characters, so the merged
// literal run is empty and the renderer's flush must emit nothing —
// the template collapses to a single placeholder. This pins the
// `literal.Len() > 0` guard in `renderConcatAsTemplate`; an
// unconditional flush would still work here, so the case doubles as
// the smallest single-expression template output the fixer produces.
//
// 1. Snapshot a concat whose only literal is the empty string.
// 2. Apply `prefer-template` fix.
// 3. Assert the output is a bare `${a}` template.
//
// @evidence contracts/testing.md#behavioral-verification Fixes empty-string plus a as a bare interpolation without adding literal characters.
// @evidence contracts/testing.md#independent-expectations Empty string contributes no characters but establishes string coercion; authored ${a} preserves that meaning.
// @evidence contracts/testing.md#distinguishing-cases Empty literal operand is the zero-length segment boundary beside ordinary prefix/suffix cases.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot, applies the rule's actual edits to the fixture and compares complete independently authored output. This Test entry owns this exact source/output pair. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestFixPreferTemplateRendersEmptyStringOperandAsBarePlaceholder(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const a: any = 1;\nconst s = \"\" + a;\nJSON.stringify(s);\n",
    "const a: any = 1;\nconst s = `${a}`;\nJSON.stringify(s);\n",
  )
}
