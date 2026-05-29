package linthost

import "testing"

// TestRuleCorpusUnicornPreferOptionalCatchBinding verifies
// unicorn/prefer-optional-catch-binding reports a `catch (e)` whose body
// never references the binding.
//
// The rule matches catch bindings named `e` or `error` and uses a text
// scan of the catch block as a loose "binding unused" proxy. This
// fixture pins the canonical positive case: binding `e`, body does not
// mention `e`, so the binding identifier is reported.
//
// 1. Enable unicorn/prefer-optional-catch-binding via an expect annotation.
// 2. Write a `catch (e)` block that never reads `e`.
// 3. Assert the binding identifier is reported on the catch line.
func TestRuleCorpusUnicornPreferOptionalCatchBinding(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-optional-catch-binding.ts", "try {\n  throw new Error(\"x\");\n  // expect: unicorn/prefer-optional-catch-binding error\n} catch (e) {\n  void 0;\n}\n")
}
