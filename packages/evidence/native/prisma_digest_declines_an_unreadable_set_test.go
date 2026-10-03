package evidence

import (
  "testing"
)

/**
 * Verifies an unreadable file keeps the whole set out of the cache.
 *
 * A set is parsed together, so a partial key would describe a parse that never
 * happened. Keying on what could be read would let a set hit after its missing
 * file returns, answering with models parsed while that file was absent.
 *
 *  1. Digest a set naming a file that does not exist.
 *  2. Assert no key is produced.
 *
 * @evidence contracts/testing.md#behavioral-verification prismaContentDigest returns empty when one requested member is absent.
 * @evidence contracts/testing.md#independent-expectations The fixture never creates the missing member.
 * @evidence contracts/testing.md#distinguishing-cases A partially readable set cannot become cacheable.
 * @evidence contracts/testing.md#execution-ownership TestPrismaDigestDeclinesAnUnreadableSet is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaDigestDeclinesAnUnreadableSet(t *testing.T) {
  root := prismaDigestRoot(t, map[string]string{
    "prisma/a.prisma": "model A {\n  id String @id\n}\n",
  })
  if prismaContentDigest(root, []string{"prisma/a.prisma", "prisma/absent.prisma"}) != "" {
    t.Fatal("a set with an unreadable member must not be cacheable")
  }
}
