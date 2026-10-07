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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule over docs/spec/rules.md and a claim document whose only citation sits inside a multi-line HTML comment (`<!--`, tag line, `-->`); assertNoProblems requires an empty diagnostic list.
 * @evidence contracts/testing.md#independent-expectations The expected result is empty by contract: a tag in an HTML comment is the supported Markdown declaration form, and because it is the document's only citation, silence also shows it was read as the acknowledgement (an unread tag would leave a missing-acknowledgement diagnostic).
 * @evidence contracts/testing.md#distinguishing-cases One positive-read case with the tag on its own line between the comment delimiters, which is the shape that fails if the scan loses track of being inside a comment; a prose tag outside a comment is owned by the sibling markdown prose entries.
 * @evidence contracts/testing.md#execution-ownership TestAMarkdownTagInsideACommentIsNotReported is a Go unit entry in the native test process; runIndexRule writes the Markdown fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestAMarkdownTagInsideACommentIsNotReported(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec/rules.md": "## Pricing {#pricing}\n",
    "docs/claim/plan.md": "## Plan {#plan}\n\n<!--\n@evidence docs/spec/rules.md#pricing Inside a multi-line comment.\n-->\n",
  }, proseTagConfig))
}
