package linthost

import "testing"

// TestFixDotNotationKeepsBracketForReservedWordKey verifies a reserved-
// word key (`box["class"]`) is detected but NOT rewritten.
//
// Even though modern parsers accept dot access to keywords, minifiers
// and older engines can break — the safe choice is to keep bracket
// syntax for reserved-word keys, mirroring ESLint's
// `allowKeywords: false` mode. This pin is independent of the main
// rewrite branch and exercises the "detect but skip fix" arm.
//
// 1. Snapshot `box["class"]`.
// 2. Enable `dot-notation`.
// 3. Assert the rule fires but emits no fix snapshot.
func TestFixDotNotationKeepsBracketForReservedWordKey(t *testing.T) {
	assertNoFixSnapshot(
		t,
		"dot-notation",
		"const box: any = { class: \"ttsc\" };\nconst value = box[\"class\"];\nJSON.stringify(value);\n",
	)
}
