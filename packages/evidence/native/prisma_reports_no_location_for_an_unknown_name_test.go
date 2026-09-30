package evidence

import (
  "testing"
)

/**
 * Verifies an unlocatable name is simply absent rather than guessed at.
 *
 * The locator is subordinate to the parser: it may never invent a unit, and it
 * may never claim a position it did not find. Answering with a default line
 * would be indistinguishable from a real location at every call site, so the
 * absence is the contract — the caller is what decides the file-level fallback.
 *
 *  1. Scan a schema declaring one model.
 *  2. Assert a name it does not declare is missing from the result.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification scanPrismaFile omits Absent and Sale.absent.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The fixture contains neither negative identity.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Unknown declarations cannot receive invented fallback positions.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaReportsNoLocationForAnUnknownName is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaReportsNoLocationForAnUnknownName(t *testing.T) {
  locations := prismaLocationsOf("model Sale {\n  id String @id\n}\n")
  if _, invented := locations["Absent"]; invented {
    t.Fatal("the locator must not answer for a name it did not read")
  }
  if _, invented := locations["Sale.absent"]; invented {
    t.Fatal("the locator must not answer for a member it did not read")
  }
}
