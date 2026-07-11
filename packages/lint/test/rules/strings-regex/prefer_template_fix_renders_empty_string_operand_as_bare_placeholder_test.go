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
func TestFixPreferTemplateRendersEmptyStringOperandAsBarePlaceholder(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const a: any = 1;\nconst s = \"\" + a;\nJSON.stringify(s);\n",
    "const a: any = 1;\nconst s = `${a}`;\nJSON.stringify(s);\n",
  )
}
