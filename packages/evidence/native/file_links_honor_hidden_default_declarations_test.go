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
 * 3. Assert each anonymous default reports its own withdrawal tag.
 *
 * @evidence contracts/testing.md#behavioral-verification For each of the tags `internal`, `hidden` and `ignore` and each of an anonymous default class and an anonymous default function, runIndexRule runs the graph rule over a target.ts whose block carries only that tag and a review.md linking `target.ts#default`; every run must report a message containing `carries '@<tag>'`.
 * @evidence contracts/testing.md#independent-expectations The expected wording is authored from the withdrawal contract: an anonymous default has a public identity even without a name node, so a withdrawal tag on it must withdraw it and the link must be refused with the tag named.
 * @evidence contracts/testing.md#distinguishing-cases Three withdrawal tags crossed with two anonymous default forms (six plain-loop iterations); only the withdrawal message is asserted, not the coverage diagnostics.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksHonorHiddenDefaultDeclarations is a Go unit entry in the native test process that loops over six combinations (not named subtests); runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestFileLinksHonorHiddenDefaultDeclarations(t *testing.T) {
  for _, tag := range []string{"internal", "hidden", "ignore"} {
    for _, source := range []string{"export default class { static value = 1; }", "export default function (): void {}"} {
      messages := runIndexRule(t, map[string]string{"target.ts": "/** @" + tag + " */\n" + source, "review.md": "## Review\n<!-- @link target.ts#default Reviews the declaration. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","files":["target.ts"],"symbol":["type","function","property"]}}]}`)
      assertProblemContains(t, messages, "carries '@"+tag+"'")
    }
  }
}
