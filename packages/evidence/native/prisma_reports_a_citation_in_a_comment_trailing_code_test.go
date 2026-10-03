package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a citation in a comment that trails code is reported truthfully.
 *
 * Prisma reads a trailing `///` or `/* *\/` as documentation of the field on its
 * own line, measured against the installed parser, while this graph reads a
 * citation only from the lines above a declaration. The report therefore may
 * not claim the comment documents nothing; it names the one placement that
 * works. A trailing `//` is discarded by Prisma and keeps its own report.
 *
 *  1. Write a citation in a trailing `///` and in a trailing block comment.
 *  2. Assert each is reported once, naming its line and the move above the
 *     declaration, and hosts nothing.
 *  3. Write a trailing `//` and assert it keeps the discarded-comment report.
 *
 * @evidence contracts/testing.md#behavioral-verification prismaClaimOf over a schema with trailing `///`, `/* *\/` and `//` citations hosts no declaration and reports `sits in a comment that trails code` at schema.prisma:3 and :4 and `'//' line comment` at :5.
 * @evidence contracts/testing.md#independent-expectations The expected fragments and lines are literals authored from the placement contract: a citation is read only above its declaration, and the parser's trailing attachment was measured, not derived from the scan.
 * @evidence contracts/testing.md#distinguishing-cases Three trailing forms on three lines each get their own line and wording: the two documentation forms may not say the comment documents nothing, and the `//` form must still say Prisma discards it.
 * @evidence contracts/testing.md#execution-ownership TestPrismaReportsACitationInACommentTrailingCode is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaReportsACitationInACommentTrailingCode(t *testing.T) {
  declarations, problems := prismaClaimOf(`model Sale {
  /// @evidence docs/spec.md#leading Written above the field.
  price Int /// @evidence docs/spec.md#trailing-doc Written after it.
  seller Seller /* @evidence docs/spec.md#trailing-block Written after it. */
  id String @id // @evidence docs/spec.md#trailing-line Written after it.
}
`, prismaClaimModels)
  if len(declarations) != 1 || declarations[0].Target != "docs/spec.md#leading" {
    t.Fatalf("only the citation above the field hosts: %s", prismaDeclarationIndex(declarations))
  }
  if len(problems) != 3 {
    t.Fatalf("expected three problems, got %d:\n%s", len(problems), strings.Join(problems, "\n"))
  }
  for index, line := range []string{"prisma/schema.prisma:3", "prisma/schema.prisma:4"} {
    if !strings.Contains(problems[index], line) ||
      !strings.Contains(problems[index], "sits in a comment that trails code on its own line") ||
      strings.Contains(problems[index], "documents no declaration") ||
      !strings.Contains(problems[index], "directly above that declaration") {
      t.Fatalf("a trailing documentation comment must name %s and the move above: %q", line, problems[index])
    }
  }
  if !strings.Contains(problems[2], "prisma/schema.prisma:5") ||
    !strings.Contains(problems[2], "'//' line comment") {
    t.Fatalf("a trailing '//' keeps the discarded-comment report: %q", problems[2])
  }
}
