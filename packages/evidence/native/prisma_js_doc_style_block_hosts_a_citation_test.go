package evidence

import (
  "testing"
)

/**
 * Verifies a citation written in a JSDoc-style block hosts like any other.
 *
 * Prisma keeps a block comment as documentation exactly as it keeps a `///`
 * one — measured by running `prisma generate`, both reach the generated client
 * types and prisma-markdown's ERD, indistinguishably. Refusing one of them
 * would be this rule inventing a distinction the artifact does not have, and
 * the diagnostic that did so claimed a block comment "does not document a
 * Prisma declaration", which is false.
 *
 * The asterisks Prisma hands over as content are what makes this non-obvious:
 * the single-line form arrives as `* @evidence x` and the multi-line form
 * keeps an asterisk on every line, so the tag never opens its line. The shared
 * declaration parser already strips a leading asterisk, which is why honouring
 * the form costs nothing beyond letting it through.
 *
 *  1. Write a citation in each JSDoc-style form.
 *  2. Assert each hosts on the model below it.
 *  3. Assert nothing is reported.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaDeclarations preserves one model citation and its asserted target/reason for each block variant.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Authored block fixtures and literal fields independently specify supported syntax.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Every local variant keeps its name and assertions under this entry.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaJSDocStyleBlockHostsACitation is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
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
