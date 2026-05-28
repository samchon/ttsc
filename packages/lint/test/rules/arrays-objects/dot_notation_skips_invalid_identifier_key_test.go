package linthost

import "testing"

// TestDotNotationSkipsInvalidIdentifierKey verifies a hyphenated key
// (`box["not-valid-key"]`) emits no diagnostic at all.
//
// Bracket access is the only valid spelling when the key is not a
// legal identifier, so the detection branch must NOT flag the access.
// This pin locks the detection-level filter independent of the fix
// path.
//
// 1. Snapshot `box["not-valid-key"]`.
// 2. Enable `dot-notation`.
// 3. Assert no findings emitted.
func TestDotNotationSkipsInvalidIdentifierKey(t *testing.T) {
	assertRuleSkipsSource(
		t,
		"dot-notation",
		"const box: any = { \"not-valid-key\": \"ttsc\" };\nconst value = box[\"not-valid-key\"];\nJSON.stringify(value);\n",
	)
}
