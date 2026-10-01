package evidence

import "testing"

/**
 * Verifies private parameter properties receive the same diagnosis as body fields.
 *
 * A constructor parameter carrying a property modifier declares a class member.
 * Omitting that syntax from failure inspection falsely reports a missing member.
 *
 * 1. Declare private and protected constructor parameter properties.
 * 2. Cite each through its instance accessor.
 * 3. Assert the visibility reason and remaining public coverage obligation.
 *
 * @evidence contracts/testing.md#behavioral-verification For `private` and `protected` in turn, runIndexRule runs the graph rule over `export class A { constructor(<visibility> secret: number) {} value = 1; }` and a review.md linking `target.ts#A.prototype.secret` under a property reference; each run must contain a diagnostic with `private or protected` and one with `Missing acknowledgement`.
 * @evidence contracts/testing.md#independent-expectations The expected messages are authored from the visibility contract: a private or protected parameter property is a class member that cannot be public evidence, so the link must be refused for its visibility rather than reported as a missing member, while the public `value` stays owed.
 * @evidence contracts/testing.md#distinguishing-cases Both non-public visibilities, looped as plain iterations; the public field `value` is the remaining obligation behind the missing-acknowledgement assertion. Body-field visibility is covered by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksClassifyPrivateParameterProperties is a Go unit entry in the native test process that loops over two visibilities; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestFileLinksClassifyPrivateParameterProperties(t *testing.T) {
  for _, visibility := range []string{"private", "protected"} {
    messages := runIndexRule(t, map[string]string{"target.ts": "export class A { constructor(" + visibility + " secret: number) {} value = 1; }", "review.md": "## Review\n<!-- @link target.ts#A.prototype.secret Reads the field. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","files":["target.ts"],"symbol":"property"}}]}`)
    assertProblemContains(t, messages, "private or protected")
    assertProblemContains(t, messages, "Missing acknowledgement")
  }
}
