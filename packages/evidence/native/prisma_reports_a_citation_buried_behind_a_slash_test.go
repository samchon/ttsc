package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a citation buried behind a fourth slash is reported.
 *
 * This was the quietest failure in the artifact kind, and it is one keystroke
 * from a citation that works. Prisma's `(!"///") ~ "//"` lookahead makes
 * `//// @evidence ...` a doc comment whose text begins `/ @evidence ...`, so
 * the tag no longer opens its line: nothing parsed it, and nothing reported it
 * either. The comment is real and the schema keeps it, so an author reading
 * the file sees a citation that does nothing at all.
 *
 *  1. Bury one citation behind a fourth slash and write a valid one beside it.
 *  2. Assert the valid one still hosts.
 *  3. Assert the buried one is reported with the repair named.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaDeclarationsFromComments preserves the valid tag and reports one buried repair at schema.prisma:1.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The fixture explicitly includes valid and slash-prefixed annotations.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Malformed neighbor must not discard the valid citation.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaReportsACitationBuriedBehindASlash is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaReportsACitationBuriedBehindASlash(t *testing.T) {
  declarations, problems := prismaClaimOf(`//// @evidence docs/spec.md#buried Written with a fourth slash.
/// @evidence docs/spec.md#pricing Written correctly.
model Sale {
  price Int
  seller Seller
}
`, prismaClaimModels)
  if len(declarations) != 1 || declarations[0].Target != "docs/spec.md#pricing" {
    t.Fatalf("only the well-formed citation hosts: %s", prismaDeclarationIndex(declarations))
  }
  if len(problems) != 1 {
    t.Fatalf("expected one problem, got %d:\n%s", len(problems), strings.Join(problems, "\n"))
  }
  if !strings.Contains(problems[0], "prisma/schema.prisma:1") ||
    !strings.Contains(problems[0], "exactly three slashes") {
    t.Fatalf("the problem must name the line and the repair: %q", problems[0])
  }
}
