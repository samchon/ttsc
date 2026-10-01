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
 * @evidence contracts/testing.md#behavioral-verification Four t.Run rows call prismaClaimOf on a one-line schema fragment and each joined problem list must contain its fragment: a file-level `/// @evidence` gives `only @evidenceExclude may be unattached at file level`, a `//` exclusion gives `'//' line comment`, a `/* *\/` exclusion gives `documents no declaration`, and a `////` exclusion gives `buried behind an extra slash`.
 * @evidence contracts/testing.md#independent-expectations The expected fragments are authored from the carrier contract: only a triple-slash file-level `@evidenceExclude` is a carrier, a detached positive tag would claim schema ownership without a model, and the other comment forms are not the carrier syntax.
 * @evidence contracts/testing.md#distinguishing-cases One valid-syntax-but-wrong-tag row and three wrong-syntax rows, each its own subtest with its own diagnostic; the accepted carrier form is owned by TestGraphAcceptsFileLevelPrismaExclusionCarrier.
 * @evidence contracts/testing.md#execution-ownership TestGraphRejectsInvalidFileLevelPrismaCarrierTags is a Go unit entry in the native test process that owns four t.Run rows; each calls prismaClaimOf on an in-memory string with no Prisma bridge, filesystem, consumer install or product host.
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
