package linthost

import "testing"

// TestFixPreferTemplateEscapesBacktickInLiteralSegment verifies the
// template-body escape branch — a literal containing a raw backtick
// must be escaped so the result still parses as a single template
// literal.
//
// Without this branch a chain like `"a`b" + name` would rewrite to
// `` `a`b${name}` `` and break out of the literal. The fixer must
// rewrite raw backticks to `` \` `` so the convergence guarantee
// applies to any literal content.
//
// 1. Snapshot a concat whose literal contains a backtick.
// 2. Apply `prefer-template` fix.
// 3. Assert the backtick is escaped inside the template literal.
func TestFixPreferTemplateEscapesBacktickInLiteralSegment(t *testing.T) {
	assertFixSnapshot(
		t,
		"prefer-template",
		"const name = \"world\";\nconst s = \"a`b\" + name;\nJSON.stringify(s);\n",
		"const name = \"world\";\nconst s = `a\\`b${name}`;\nJSON.stringify(s);\n",
	)
}
