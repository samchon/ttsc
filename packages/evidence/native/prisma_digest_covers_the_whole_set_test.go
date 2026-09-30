package evidence

import (
  "testing"
)

/**
 * Verifies the set digest answers for the whole set rather than for any one
 * file.
 *
 * A schema folder is parsed as a unit, so reuse is only sound when the key
 * covers every input to that parse. Each of the three changes below leaves at
 * least one file byte-identical, and a key that hashed files independently or
 * ignored their paths would hit on a schema that no longer means what it did —
 * returning models that were deleted and omitting ones that were added, with
 * nothing red anywhere.
 *
 *  1. Digest a two-file set.
 *  2. Change one file's bytes, then add a file, then rename one.
 *  3. Assert every change produces a different key.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaContentDigest changes after byte edit,file addition or source rename and starts nonempty.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Deliberate mutations independently establish three identity changes.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Source membership/path and bytes all contribute beyond size alone.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaDigestCoversTheWholeSet is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaDigestCoversTheWholeSet(t *testing.T) {
  base := prismaDigestRoot(t, map[string]string{
    "prisma/a.prisma": "model A {\n  id String @id\n}\n",
    "prisma/b.prisma": "model B {\n  id String @id\n}\n",
  })
  original := prismaContentDigest(base, []string{"prisma/a.prisma", "prisma/b.prisma"})
  if original == "" {
    t.Fatal("a readable set must digest")
  }

  edited := prismaDigestRoot(t, map[string]string{
    "prisma/a.prisma": "model A {\n  id String @id\n  extra Int\n}\n",
    "prisma/b.prisma": "model B {\n  id String @id\n}\n",
  })
  if prismaContentDigest(edited, []string{"prisma/a.prisma", "prisma/b.prisma"}) == original {
    t.Fatal("editing one file of the set must change the key")
  }

  grown := prismaDigestRoot(t, map[string]string{
    "prisma/a.prisma": "model A {\n  id String @id\n}\n",
    "prisma/b.prisma": "model B {\n  id String @id\n}\n",
    "prisma/c.prisma": "model C {\n  id String @id\n}\n",
  })
  if prismaContentDigest(grown, []string{
    "prisma/a.prisma",
    "prisma/b.prisma",
    "prisma/c.prisma",
  }) == original {
    t.Fatal("adding a file to the set must change the key")
  }

  renamed := prismaDigestRoot(t, map[string]string{
    "prisma/a.prisma":     "model A {\n  id String @id\n}\n",
    "prisma/other.prisma": "model B {\n  id String @id\n}\n",
  })
  if prismaContentDigest(renamed, []string{"prisma/a.prisma", "prisma/other.prisma"}) == original {
    t.Fatal("moving a model between files must change the key")
  }
}
