package evidence

import (
  "testing"
)

/**
 * Verifies a plain block comment hosts a citation too.
 *
 * `/* *\/` without the extra asterisk is the same documentation to Prisma, and
 * treating the two block spellings differently would be a distinction only
 * this rule could see.
 *
 *  1. Cite from a plain block comment.
 *  2. Assert it hosts and nothing is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification prismaClaimOf accepts one plain block citation targeting docs/spec.md#a.
 * @evidence contracts/testing.md#independent-expectations The literal target is independent of parser output.
 * @evidence contracts/testing.md#distinguishing-cases Block comments need not carry JSDoc asterisks to host documentation.
 * @evidence contracts/testing.md#execution-ownership TestPrismaPlainBlockCommentHostsACitation is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaPlainBlockCommentHostsACitation(t *testing.T) {
  declarations, problems := prismaClaimOf(`/* @evidence docs/spec.md#a Written as a plain block. */
model Sale {
  price Int
  seller Seller
}
`, prismaClaimModels)
  if len(problems) != 0 {
    t.Fatalf("a documentation comment is not a problem: %v", problems)
  }
  if len(declarations) != 1 || declarations[0].Target != "docs/spec.md#a" {
    t.Fatalf("declarations: %s", prismaDeclarationIndex(declarations))
  }
}
