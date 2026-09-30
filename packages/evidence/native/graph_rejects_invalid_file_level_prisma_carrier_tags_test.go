package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies file-level Prisma carriers accept exclusions only and retain the
 * existing placement and resolution failures.
 *
 * A detached `@evidence` would claim schema ownership without a model, while
 * double-slash, block, and buried forms are not the file carrier syntax.
 *
 *  1. Exercise file-level ownership and each invalid comment form.
 *  2. Scan every case through the native Prisma declaration locator.
 *  3. Assert every case names its exact invalid boundary.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaClaimOf and its native comment scanner exercises this case: Verifies file-level Prisma carriers accept exclusions only and retain the existing placement and resolution failures. The original assertions check assert every case names its exact invalid boundary.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A detached `@evidence` would claim schema ownership without a model, while double-slash, block, and buried forms are not the file carrier syntax. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Exercise file-level ownership and each invalid comment form. Scan every case through the native Prisma declaration locator. Assert every case names its exact invalid boundary. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphRejectsInvalidFileLevelPrismaCarrierTags is the selectable Go test entry; its local loops and closures remain owned by this entry. It exercises prismaClaimOf and its native comment scanner within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphRejectsInvalidFileLevelPrismaCarrierTags(t *testing.T) {
  cases := []struct {
    name     string
    carrier  string
    expected string
  }{
    {
      name:     "ownership evidence",
      carrier:  "/// @evidence docs/spec.md#contract A file cannot own this evidence.\n",
      expected: "only @evidenceExclude may be unattached at file level",
    },
    {
      name:     "line comment",
      carrier:  "// @evidenceExclude docs/spec.md#contract Prisma discards this line.\n",
      expected: "'//' line comment",
    },
    {
      name:     "block comment",
      carrier:  "/* @evidenceExclude docs/spec.md#contract Only triple slash opens a file carrier. */\n",
      expected: "documents no declaration",
    },
    {
      name:     "buried fourth slash",
      carrier:  "//// @evidenceExclude docs/spec.md#contract The tag is buried.\n",
      expected: "buried behind an extra slash",
    },
  }
  for _, entry := range cases {
    t.Run(entry.name, func(t *testing.T) {
      _, problems := prismaClaimOf(entry.carrier, nil)
      if !strings.Contains(strings.Join(problems, "\n"), entry.expected) {
        t.Fatalf(
          "expected diagnostic containing %q, got:\n%s",
          entry.expected,
          strings.Join(problems, "\n"),
        )
      }
    })
  }
}
