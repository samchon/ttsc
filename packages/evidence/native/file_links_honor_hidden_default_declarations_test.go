package evidence

import "testing"

/**
 * Verifies withdrawal applies to anonymous defaults as well as named exports.
 *
 * An anonymous default has a public identity even though it has no name node.
 * Skipping it while collecting withdrawal tags silently publishes hidden code.
 *
 * 1. Mark default classes and functions internal, hidden, or ignored.
 * 2. Cite each through the module's default address.
 * 3. Assert the withdrawal reason is reported and never satisfies coverage.
 */
func TestFileLinksHonorHiddenDefaultDeclarations(t *testing.T) {
  for _, tag := range []string{"internal", "hidden", "ignore"} {
    for _, source := range []string{"export default class { static value = 1; }", "export default function (): void {}"} {
      messages := runIndexRule(t, map[string]string{"target.ts": "/** @" + tag + " */\n" + source, "review.md": "## Review\n<!-- @link target.ts#default Reviews the declaration. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","files":["target.ts"],"symbol":["type","function","property"]}}]}`)
      assertProblemContains(t, messages, "carries '@"+tag+"'")
    }
  }
}
