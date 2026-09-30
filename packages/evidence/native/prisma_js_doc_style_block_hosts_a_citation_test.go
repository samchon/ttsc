package evidence

import (
  "testing"
)

/**
 * Verifies single-line and multi-line JSDoc blocks host model citations.
 *
 * The scanner must recognize each documentation form and strip its leading
 * asterisks before attaching the tag to the supplied model inventory. This
 * direct attribution case does not invoke Prisma generation or a Node parser.
 *
 *  1. Write both block-comment forms before the model.
 *  2. Scan them with an authored model population.
 *  3. Assert one model-hosted citation to docs/spec.md#a and no problems.
 *
 * @evidence contracts/testing.md#behavioral-verification prismaClaimOf preserves one model citation and its asserted model host and target for each block variant.
 * @evidence contracts/testing.md#independent-expectations Authored block fixtures and literal host/target independently specify supported syntax.
 * @evidence contracts/testing.md#distinguishing-cases Single-line and multi-line leading-asterisk forms execute here; the reason text is fixture input but is not separately asserted.
 * @evidence contracts/testing.md#execution-ownership TestPrismaJSDocStyleBlockHostsACitation is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaJSDocStyleBlockHostsACitation(t *testing.T) {
  for name, schema := range map[string]string{
    "single line": "/** @evidence docs/spec.md#a Written JSDoc style. */\nmodel Sale {\n  price Int\n  seller Seller\n}\n",
    "multi line":  "/**\n * @evidence docs/spec.md#a Written JSDoc style.\n */\nmodel Sale {\n  price Int\n  seller Seller\n}\n",
  } {
    declarations, problems := prismaClaimOf(schema, prismaClaimModels)
    if len(problems) != 0 {
      t.Fatalf("%s: a documentation comment is not a problem: %v", name, problems)
    }
    if len(declarations) != 1 {
      t.Fatalf("%s: expected one citation, got %d", name, len(declarations))
    }
    if declarations[0].Hosts.names() != "model" ||
      declarations[0].Target != "docs/spec.md#a" {
      t.Fatalf("%s: %s", name, prismaDeclarationIndex(declarations))
    }
  }
}
