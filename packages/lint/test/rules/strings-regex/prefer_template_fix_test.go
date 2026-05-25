package linthost

import "testing"

// TestFixPreferTemplateRewritesConcatChainIntoTemplateLiteral verifies that
// the preferTemplate rule emits an autofix collapsing a `string + expr`
// chain into a single backtick-template literal.
//
// The detection only fires on the topmost `+` chain, so the fixer must
// flatten the whole chain in one pass; otherwise a partial rewrite would
// leave nested template literals or stranded `+` operators. The zod and
// rxjs fixtures had to drop this rule because the cascade could not
// converge — locking the 3-part concat shape protects the convergence
// guarantee. The template-body escape branch must also be exercised so
// embedded backticks and `${` sequences cannot break out of the literal.
//
//  1. Snapshot a 3-part concat (`"hi " + name + "!"`) to lock the canonical
//     `${…}` interpolation flow.
//  2. Snapshot a chain whose literal contains a backtick so the body-escape
//     branch is exercised.
//  3. Snapshot a leading-identifier chain (`a + "b"`) so the placeholder
//     appears as the first template segment.
func TestFixPreferTemplateRewritesConcatChainIntoTemplateLiteral(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const name = \"world\";\nconst s = \"hi \" + name + \"!\";\nJSON.stringify(s);\n",
    "const name = \"world\";\nconst s = `hi ${name}!`;\nJSON.stringify(s);\n",
  )
  assertFixSnapshot(
    t,
    "prefer-template",
    "const name = \"world\";\nconst s = \"a`b\" + name;\nJSON.stringify(s);\n",
    "const name = \"world\";\nconst s = `a\\`b${name}`;\nJSON.stringify(s);\n",
  )
  assertFixSnapshot(
    t,
    "prefer-template",
    "const a: any = 1;\nconst s = a + \"b\";\nJSON.stringify(s);\n",
    "const a: any = 1;\nconst s = `${a}b`;\nJSON.stringify(s);\n",
  )
}
