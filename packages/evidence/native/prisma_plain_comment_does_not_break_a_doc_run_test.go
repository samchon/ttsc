package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a citation reaches its declaration across an intervening plain
 * comment, and that two doc runs around one are a single comment block.
 *
 * Measured against the real parser: `/// first`, `// plain`, `/// second` above
 * a model produces the documentation `"first\nsecond"`. Treating the plain line
 * as a break would leave the first citation documenting nothing and reported as
 * misplaced, on a schema Prisma reads exactly as the author intended.
 *
 *  1. Separate two citations with a plain comment.
 *  2. Assert both host on the model, each at its own line.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaDeclarationsFromComments retains the expected index across an ordinary comment.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Authored schema and literal host/line/reason expectation establish continuity.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Harmless plain comment differs from a discarded documentation run.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaPlainCommentDoesNotBreakADocRun is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaPlainCommentDoesNotBreakADocRun(t *testing.T) {
  declarations, problems := prismaClaimOf(`/// @evidence docs/spec.md#a First ground.
// an ordinary note
/// @evidence docs/spec.md#b Second ground.
model Sale {
  price Int
  seller Seller
}
`, prismaClaimModels)
  if len(problems) != 0 {
    t.Fatalf("a plain comment without a tag is not a problem: %v", problems)
  }
  want := strings.Join([]string{
    "evidence@1 host=model target=docs/spec.md#a reason=First ground.",
    "evidence@3 host=model target=docs/spec.md#b reason=Second ground.",
  }, "\n")
  if got := prismaDeclarationIndex(declarations); got != want {
    t.Fatalf("declarations:\n%s\nwant:\n%s", got, want)
  }
}
