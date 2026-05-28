package linthost

import "testing"

// TestFixPreferTemplateRewritesThreePartConcatChain verifies the
// canonical `"hi " + name + "!"` → `` `hi ${name}!` `` rewrite.
//
// Detection fires only on the topmost `+` chain, so the fixer must
// flatten the whole chain in one pass; otherwise a partial rewrite
// would leave nested template literals or stranded `+` operators. The
// zod and rxjs fixtures had to drop this rule because the cascade
// could not converge — pinning the 3-part shape protects the
// convergence guarantee.
//
// 1. Snapshot a 3-part concat (`"hi " + name + "!"`).
// 2. Apply `prefer-template` fix.
// 3. Assert the result is the canonical template literal.
func TestFixPreferTemplateRewritesThreePartConcatChain(t *testing.T) {
	assertFixSnapshot(
		t,
		"prefer-template",
		"const name = \"world\";\nconst s = \"hi \" + name + \"!\";\nJSON.stringify(s);\n",
		"const name = \"world\";\nconst s = `hi ${name}!`;\nJSON.stringify(s);\n",
	)
}
