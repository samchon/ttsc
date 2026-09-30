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
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies private parameter properties receive the same diagnosis as body fields.
 *
 * @evidence contracts/testing.md#independent-expectations TypeScript private/protected constructor properties cannot be public evidence; the literal restriction and missing-acknowledgement messages expose accidental publication.
 *
 * @evidence contracts/testing.md#distinguishing-cases Declare private and protected constructor parameter properties. Cite each through its instance accessor. Assert the visibility reason and remaining public coverage obligation.
 *
 * @evidence contracts/testing.md#execution-ownership TestFileLinksClassifyPrivateParameterProperties is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestFileLinksClassifyPrivateParameterProperties(t *testing.T) {
  for _, visibility := range []string{"private", "protected"} {
    messages := runIndexRule(t, map[string]string{"target.ts": "export class A { constructor(" + visibility + " secret: number) {} value = 1; }", "review.md": "## Review\n<!-- @link target.ts#A.prototype.secret Reads the field. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","files":["target.ts"],"symbol":"property"}}]}`)
    assertProblemContains(t, messages, "private or protected")
    assertProblemContains(t, messages, "Missing acknowledgement")
  }
}
