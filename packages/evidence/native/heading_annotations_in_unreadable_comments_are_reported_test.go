package evidence

import (
  "strings"
  "testing"
)

/**
 * TestHeadingAnnotationsInUnreadableCommentsAreReported verifies a
 * heading-form tag written where nothing reads it is reported like a line
 * form.
 *
 * TypeScript reads tags only from attached documentation blocks, and Prisma
 * only from a `///` run with exactly three slashes. A heading section in a `//`
 * comment, in a Prisma line comment, or behind a fourth slash reaches no host.
 * Discarding it silently would leave the coverage diagnostic that follows
 * asking for the citation the author already wrote.
 *
 *  1. Put a heading-form citation in a TypeScript line comment above an export.
 *  2. Put one in a Prisma line comment and one behind a fourth slash.
 *  3. Require each to be reported with its existing repair.
 *
 * @evidence contracts/testing.md#behavioral-verification runUnreadableRule runs graphRule.Check over a TypeScript file whose `//` comment carries a heading-form `@evidence` section and requires `Unreadable @evidence at src/contracts.ts:4`; prismaClaimOf scans a model preceded by a `//` heading-form citation and one preceded by a `////` heading-form citation, requiring the line-comment and buried-slash diagnostics respectively.
 * @evidence contracts/testing.md#independent-expectations Line comments are not TypeScript or Prisma documentation and a fourth slash makes the tag content, so each heading-form tag must be reported with the message its line form already receives; the line numbers are the authored fixture's.
 * @evidence contracts/testing.md#distinguishing-cases The TypeScript fixture keeps an attached valid citation as its control; the two Prisma rows differ only by the comment marker. Visible Markdown headings are owned by the Markdown heading entries.
 * @evidence contracts/testing.md#execution-ownership TestHeadingAnnotationsInUnreadableCommentsAreReported is a native Go unit entry; runUnreadableRule writes temporary fixtures and calls the graph rule in-process, and prismaClaimOf scans strings without the Prisma bridge, a consumer install or a product host.
 */
func TestHeadingAnnotationsInUnreadableCommentsAreReported(t *testing.T) {
  t.Run("typescript line comment", func(t *testing.T) {
    assertReportedAmong(t, runUnreadableRule(t, `/** @evidence docs/spec.md#pricing The declaration cites this. */
export const limit = 1;

// ## @evidence docs/spec.md#pricing
// A section nothing reads.
export const other = 2;
`), "Unreadable @evidence at src/contracts.ts:4")
  })
  for _, entry := range []struct {
    name     string
    marker   string
    expected string
  }{
    {name: "prisma line comment", marker: "//", expected: "'//' line comment"},
    {name: "prisma fourth slash", marker: "////", expected: "buried behind an extra slash"},
  } {
    t.Run(entry.name, func(t *testing.T) {
      _, problems := prismaClaimOf(entry.marker+" ## @evidence docs/spec.md#pricing\n"+entry.marker+" A section nothing reads.\nmodel Sale {\n  price Int\n  seller Seller\n}\n", prismaClaimModels)
      if !strings.Contains(strings.Join(problems, "\n"), entry.expected) {
        t.Fatalf("expected diagnostic containing %q, got:\n%s", entry.expected, strings.Join(problems, "\n"))
      }
    })
  }
}
