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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies withdrawal applies to anonymous defaults as well as named exports.
 *
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The authored internal, hidden, and ignore tags withdraw anonymous defaults. Each literal withdrawal reason must appear; the case does not separately count coverage diagnostics.
 *
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Mark default classes and functions internal, hidden, or ignored. Cite each through the module's default address. Assert each anonymous default reports its own withdrawal tag.
 *
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestFileLinksHonorHiddenDefaultDeclarations is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestFileLinksHonorHiddenDefaultDeclarations(t *testing.T) {
  for _, tag := range []string{"internal", "hidden", "ignore"} {
    for _, source := range []string{"export default class { static value = 1; }", "export default function (): void {}"} {
      messages := runIndexRule(t, map[string]string{"target.ts": "/** @" + tag + " */\n" + source, "review.md": "## Review\n<!-- @link target.ts#default Reviews the declaration. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","files":["target.ts"],"symbol":["type","function","property"]}}]}`)
      assertProblemContains(t, messages, "carries '@"+tag+"'")
    }
  }
}
