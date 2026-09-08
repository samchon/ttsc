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
