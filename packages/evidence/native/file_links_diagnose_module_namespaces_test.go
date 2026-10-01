package evidence

import "testing"

/**
 * Verifies module namespace failures identify the existing namespace correctly.
 *
 * A module namespace publishes declarations but is not itself an evidence unit.
 * A missing child must not be reported as a nonexistent namespace export.
 *
 * 1. Publish a value and a namespace that returns to its declaring module.
 * 2. Cite the namespace itself and missing children at successive depths.
 * 3. Check precise diagnostics and verify none supplies coverage for the value.
 *
 * @evidence contracts/testing.md#behavioral-verification Three t.Run rows link `api/index.ts#self`, `#self.missing` and `#self.self.missing` over `export const value = 1; export * as self from './index';`; each must report its own problem (`'self' is a module namespace`, `namespace 'self' exports no declaration named 'missing'`, `namespace 'self.self' exports no declaration named 'missing'`) and `Missing acknowledgement for 'value'`.
 * @evidence contracts/testing.md#independent-expectations The expected problems are authored literals for the contract that a module namespace is not a declaration: a missing child must name the missing segment and the existing namespace, and none of these invalid links may supply coverage for the value.
 * @evidence contracts/testing.md#distinguishing-cases The namespace itself and missing children at depth one and two; the value remaining owed in every row shows no failed link discharges it.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksDiagnoseModuleNamespaces is a Go unit entry in the native test process that owns three t.Run rows; each drives graphRule.Check through newFileLinkFixture over real temp files, with no consumer install or product host.
 */
func TestFileLinksDiagnoseModuleNamespaces(t *testing.T) {
  for _, test := range []struct{ target, problem string }{
    {"self", "'self' is a module namespace"},
    {"self.missing", "namespace 'self' exports no declaration named 'missing'"},
    {"self.self.missing", "namespace 'self.self' exports no declaration named 'missing'"},
  } {
    t.Run(test.target, func(t *testing.T) {
      fixture := newFileLinkFixture(t, map[string]string{
        "api/index.ts": "export const value = 1; export * as self from './index';",
        "review.md":    "## Review\n<!-- @link api/index.ts#" + test.target + " Reads the namespace. -->\n",
      }, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":"property"}}]}`)
      messages := fixture.check()
      assertProblemContains(t, messages, test.problem)
      assertProblemContains(t, messages, "Missing acknowledgement for 'value'")
    })
  }
}
