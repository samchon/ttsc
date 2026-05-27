package linthost

import "testing"

// TestRuleCorpusUnicornCatchErrorName verifies unicorn/catch-error-name reports
// a catch binding named anything other than `error`.
//
// The rule visits each CatchClause and flags the binding identifier when it is
// neither the canonical `error` nor a destructuring pattern. This fixture pins
// the common-case shape `catch (err)` so the identifier-text comparison stays
// covered.
//
// 1. Enable unicorn/catch-error-name via an expect annotation.
// 2. Use a catch clause with the binding name `err`.
// 3. Assert the binding identifier is reported.
func TestRuleCorpusUnicornCatchErrorName(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/catch-error-name.ts", "// expect: unicorn/catch-error-name error\ntry { } catch (err) { void err; }\n")
}
