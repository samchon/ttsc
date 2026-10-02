package linthost

import "testing"

// TestFixPreferTemplateEscapesBacktickInLiteralSegment verifies the
// template-body escape branch — a literal containing a raw backtick
// must be escaped so the result still parses as a single template
// literal.
//
// Without this branch a chain like `"a`b" + name` would rewrite to
// “ `a`b${"" + (name)}` “ and break out of the literal. The fixer must
// rewrite raw backticks to “ \` “ so the convergence guarantee
// applies to any literal content.
//
// 1. Snapshot a concat whose literal contains a backtick.
// 2. Apply `prefer-template` fix.
// 3. Assert the backtick is escaped inside the template literal.
//
// @evidence contracts/testing.md#behavioral-verification Fixes concatenation while escaping the literal backtick inside the template.
// Every dynamic slot explicitly retains default-hint concatenation coercion.
//
// @evidence contracts/testing.md#independent-expectations The literal expected escaped backtick preserves the original string character and cannot terminate the new template.
// @evidence contracts/testing.md#distinguishing-cases Embedded delimiter boundary complements ordinary three-part concatenation.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot, applies the rule's actual edits to the fixture and compares complete independently authored output. This Test entry owns this exact source/output pair. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestFixPreferTemplateEscapesBacktickInLiteralSegment(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const name = \"world\";\nconst s = \"a`b\" + name;\nJSON.stringify(s);\n",
    "const name = \"world\";\nconst s = `a\\`b${\"\" + (name)}`;\nJSON.stringify(s);\n",
  )
}
