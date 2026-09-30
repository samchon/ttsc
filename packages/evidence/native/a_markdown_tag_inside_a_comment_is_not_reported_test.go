package evidence

import (
  "testing"
)

/**
 * Verifies a tag inside an HTML comment is untouched.
 *
 * Every case above asserts that something new is said, and a reporter that said
 * it about every tag would satisfy them all while making the rule unusable. A
 * comment spanning several lines is the shape that fails first if the scan
 * forgets it is still inside one, and it is the only citation here, so the
 * assertion also proves the tag was read rather than merely unreported.
 *
 *  1. Write a multi-line comment carrying the document's only citation.
 *  2. Evaluate the same claim.
 *  3. Assert nothing is reported, so it was read and not named.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies a tag inside an HTML comment is untouched.
 *
 * @evidence contracts/testing.md#independent-expectations The multiline HTML comment contains the only acknowledgement. No problems means both that it was read and that it was not misreported as prose.
 *
 * @evidence contracts/testing.md#distinguishing-cases Write a multi-line comment carrying the document's only citation. Evaluate the same claim. Assert nothing is reported, so it was read and not named.
 *
 * @evidence contracts/testing.md#execution-ownership TestAMarkdownTagInsideACommentIsNotReported is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestAMarkdownTagInsideACommentIsNotReported(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec/rules.md": "## Pricing {#pricing}\n",
    "docs/claim/plan.md": "## Plan {#plan}\n\n<!--\n@evidence docs/spec/rules.md#pricing Inside a multi-line comment.\n-->\n",
  }, proseTagConfig))
}
