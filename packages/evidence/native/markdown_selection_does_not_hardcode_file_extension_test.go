package evidence

import (
  "testing"
)

/**
 * Verifies the Markdown discriminator, not a hard-coded file extension,
 * determines which configured files are parsed as Markdown.
 *
 * The public contract accepts project-relative globs and never narrows them to
 * `.md`. Repositories may use `.markdown` or extensionless documentation, so a
 * matching configured file must not disappear before glob evaluation.
 *
 *  1. Configure a `.markdown` source file explicitly.
 *  2. Acknowledge its H2 unit from TypeScript.
 *  3. Assert the non-`.md` document participates in the graph.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies the Markdown discriminator, not a hard-coded file extension, determines which configured files are parsed as Markdown.
 *
 * @evidence contracts/testing.md#independent-expectations An explicit markdown population includes spec.markdown and its contract H2, acknowledged by the authored TypeScript citation. This is a successful selection case rather than an independent inventory count.
 *
 * @evidence contracts/testing.md#distinguishing-cases Configure a `.markdown` source file explicitly. Acknowledge its H2 unit from TypeScript. Assert the non-`.md` document participates in the graph.
 *
 * @evidence contracts/testing.md#execution-ownership TestMarkdownSelectionDoesNotHardcodeFileExtension is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestMarkdownSelectionDoesNotHardcodeFileExtension(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.markdown": "## Contract\n",
    "src/ref.ts": `
/** @evidence docs/spec.markdown#contract This type adopts the contract. */
export interface Ref {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.markdown"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}
