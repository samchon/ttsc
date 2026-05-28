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
func TestFixDotNotationRewritesBracketToDotForIdentifierKey(t *testing.T) {
	assertFixSnapshot(
		t,
		"dot-notation",
		"const box: any = { name: \"ttsc\" };\nconst value = box[\"name\"];\nJSON.stringify(value);\n",
		"const box: any = { name: \"ttsc\" };\nconst value = box.name;\nJSON.stringify(value);\n",
	)
}
