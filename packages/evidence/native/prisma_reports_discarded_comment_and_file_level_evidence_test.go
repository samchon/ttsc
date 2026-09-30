package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a discarded comment and file-level ownership evidence are reported.
 *
 * Both placements below fail differently. A `//` comment is dropped by Prisma
 * outright, so nothing downstream ever sees the tag. A detached top-level
 * `///` run can carry an exclusion, but it cannot claim an absent model owns
 * evidence.
 *
 * A block comment is deliberately absent from this list: Prisma documents a
 * declaration with one, so it hosts a citation here too.
 *
 * Each invalid placement names the move that fixes its own boundary.
 *
 *  1. Write ownership evidence in a line comment and a file-level carrier.
 *  2. Assert two problems and no declarations.
 *  3. Assert each names its own repair.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaDeclarations hosts nothing and reports exactly two placement repairs.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Deliberate discarded/file-level positions have no eligible declaration.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Each invalid placement retains its own diagnostic.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaReportsDiscardedCommentAndFileLevelEvidence is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaReportsDiscardedCommentAndFileLevelEvidence(t *testing.T) {
  declarations, problems := prismaClaimOf(`// @evidence docs/spec.md#a Written in a line comment.

/// @evidence docs/spec.md#c Detached by a blank line.

model Sale {
  price Int
  seller Seller
}
`, prismaClaimModels)
  if len(declarations) != 0 {
    t.Fatalf("an unusable placement hosts nothing: %s", prismaDeclarationIndex(declarations))
  }
  if len(problems) != 2 {
    t.Fatalf("expected one problem per placement, got %d:\n%s", len(problems), strings.Join(problems, "\n"))
  }
  joined := strings.Join(problems, "\n")
  for _, expected := range []string{
    "prisma/schema.prisma:1",
    "'//' line comment",
    "prisma/schema.prisma:3",
    "only @evidenceExclude may be unattached at file level",
  } {
    if !strings.Contains(joined, expected) {
      t.Fatalf("problems must contain %q:\n%s", expected, joined)
    }
  }
}
