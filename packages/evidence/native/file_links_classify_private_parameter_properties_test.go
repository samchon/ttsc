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
 */
func TestFileLinksClassifyPrivateParameterProperties(t *testing.T) {
  for _, visibility := range []string{"private", "protected"} {
    messages := runIndexRule(t, map[string]string{"target.ts": "export class A { constructor(" + visibility + " secret: number) {} value = 1; }", "review.md": "## Review\n<!-- @link target.ts#A.prototype.secret Reads the field. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","files":["target.ts"],"symbol":"property"}}]}`)
    assertProblemContains(t, messages, "private or protected")
    assertProblemContains(t, messages, "Missing acknowledgement")
  }
}
