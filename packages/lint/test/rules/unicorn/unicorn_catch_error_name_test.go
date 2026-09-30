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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies catch binding err violates the canonical error-name policy; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/catch-error-name annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; catch binding error is the adjacent canonical spelling. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornCatchErrorName is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornCatchErrorName(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/catch-error-name.ts", "// expect: unicorn/catch-error-name error\ntry { } catch (err) { void err; }\n")
  assertRuleSkipsSource(t, "unicorn/catch-error-name", "try {} catch (error) { void error; }\n")
}
