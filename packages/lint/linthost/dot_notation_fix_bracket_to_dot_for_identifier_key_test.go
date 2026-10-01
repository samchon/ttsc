package linthost

import "testing"

// TestFixDotNotationRewritesBracketToDotForIdentifierKey verifies the
// canonical `obj["name"]` → `obj.name` rewrite for an identifier-safe
// key.
//
// Without this fix the `fix` cascade could not converge over real
// fixtures, so the rule had to be removed from several benchmark
// configs. The identifier-key arm is the main rewrite path; the
// reserved-word and invalid-identifier arms are pinned separately.
//
// 1. Snapshot `box["name"]`.
// 2. Apply `dot-notation` fix.
// 3. Assert the result is `box.name`.
//
// @evidence contracts/testing.md#behavioral-verification The actual fix applier rewrites only box["name"] to box.name and compares the full source, preserving object initialization and the value use.
// @evidence contracts/testing.md#independent-expectations The literal expected source follows JavaScript member-access equivalence for the identifier-safe name key; it is supplied independently of the fix generator.
// @evidence contracts/testing.md#distinguishing-cases This case owns the safe identifier-key rewrite. TestDotNotationSkipsInvalidIdentifierKey and TestFixDotNotationKeepsBracketForReservedWordKey own rejected and withheld key forms.
// @evidence contracts/testing.md#execution-ownership TestFixDotNotationRewritesBracketToDotForIdentifierKey owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestFixDotNotationRewritesBracketToDotForIdentifierKey(t *testing.T) {
  assertFixSnapshot(
    t,
    "dot-notation",
    "const box: any = { name: \"ttsc\" };\nconst value = box[\"name\"];\nJSON.stringify(value);\n",
    "const box: any = { name: \"ttsc\" };\nconst value = box.name;\nJSON.stringify(value);\n",
  )
}
