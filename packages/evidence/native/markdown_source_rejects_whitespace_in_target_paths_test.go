package evidence

import (
  "testing"
)

/**
 * Verifies whitespace-bearing Markdown paths fail with the target grammar's
 * real repair instead of producing an impossible missing acknowledgement.
 *
 * Evidence targets are one whitespace-delimited token. A source path containing
 * spaces cannot be written in `@evidence <target> <reason>`, so materializing it
 * would create an obligation no declaration can ever satisfy.
 *
 *  1. Select a Markdown file whose project-relative path contains a space.
 *  2. Evaluate it as an H2 evidence source.
 *  3. Assert the rule asks for a rename and suppresses the generic no-unit error.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies whitespace-bearing Markdown paths fail with the target grammar's real repair instead of producing an impossible missing acknowledgement.
 *
 * @evidence contracts/testing.md#independent-expectations A whitespace-bearing source path cannot be one target token. Its literal path repair must appear and the generic no-unit diagnostic must remain absent.
 *
 * @evidence contracts/testing.md#distinguishing-cases Select a Markdown file whose project-relative path contains a space. Evaluate it as an H2 evidence source. Assert the rule asks for a rename and suppresses the generic no-unit error.
 *
 * @evidence contracts/testing.md#execution-ownership TestMarkdownSourceRejectsWhitespaceInTargetPaths is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestMarkdownSourceRejectsWhitespaceInTargetPaths(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/my spec.md": "## Contract\n",
    "src/ref.ts":      "export interface Ref {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/my spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "path contains whitespace")
  if countProblemsContaining(messages, "materialized no selected evidence units") != 0 {
    t.Fatalf("generic materialization diagnostic hid the path repair: %v", messages)
  }
}
