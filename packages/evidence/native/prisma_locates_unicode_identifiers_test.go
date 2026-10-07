package evidence

import (
  "testing"
)

/**
 * Verifies a unicode identifier is located.
 *
 * Prisma's grammar admits any unicode alphanumeric in an identifier, and a
 * scanner written against ASCII would drop such a model entirely — leaving a
 * unit the parser did return with a file-level location, in the one codebase
 * shape where every model is spelled that way.
 *
 *  1. Scan a model whose name and member are non-ASCII.
 *  2. Assert both are located.
 *
 * @evidence contracts/testing.md#behavioral-verification scanPrismaFile preserves checked Unicode model/member locations.
 * @evidence contracts/testing.md#independent-expectations Literal Unicode names and expected positions define valid identifiers.
 * @evidence contracts/testing.md#distinguishing-cases Non-ASCII spelling retains lexical identity.
 * @evidence contracts/testing.md#execution-ownership TestPrismaLocatesUnicodeIdentifiers is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaLocatesUnicodeIdentifiers(t *testing.T) {
  locations := prismaLocationsOf(`model 판매 {
  식별자 String @id
}
`)
  assertPrismaLine(t, locations, "판매", 1)
  assertPrismaLine(t, locations, "판매.식별자", 2)
}
