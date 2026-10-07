package evidence

import (
  "testing"
)

/**
 * Verifies a Prisma schema decodes as a claim and as a reference.
 *
 * Prisma joins Markdown and TypeScript as an artifact that works in both
 * directions, and Swagger stays the only evidence-only kind. Both halves matter
 * to the product: a model citing the requirement that asked for it, and a
 * provider citing the model it persists.
 *
 *  1. Configure a Prisma claim citing Markdown and a TypeScript claim citing
 *     Prisma.
 *  2. Decode the configuration.
 *  3. Assert both decode with the artifact kinds they named.
 *
 * @evidence contracts/testing.md#behavioral-verification decodePrismaConfig accepts Prisma claims and references with their proper artifact kinds.
 * @evidence contracts/testing.md#independent-expectations Literal configuration sides define supported placement.
 * @evidence contracts/testing.md#distinguishing-cases The body has the two positive cases, a Prisma claim over a Markdown reference and a TypeScript claim over a Prisma reference; it contains no rejected case, so the Swagger-claim refusal is owned by another test.
 * @evidence contracts/testing.md#execution-ownership TestPrismaConfigurationOpensBothDirections is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaConfigurationOpensBothDirections(t *testing.T) {
  config, problems := decodePrismaConfig(t, `{"claims":[
    {
      "type":"prisma",
      "name":"Every model justifies itself",
      "files":["prisma/schema/**/*.prisma"],
      "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
    },
    {
      "type":"typescript",
      "files":["src/providers/**/*.ts"],
      "symbol":"function",
      "reference":{"type":"prisma","files":["prisma/schema/**/*.prisma"]}
    }
  ]}`)
  if len(problems) != 0 {
    t.Fatalf("both directions must decode: %v", problems)
  }
  if len(config.Claims) != 2 {
    t.Fatalf("expected two claims, got %d", len(config.Claims))
  }
  if config.Claims[0].Type != artifactPrisma {
    t.Fatalf("a Prisma claim must decode as one, got %q", config.Claims[0].Type)
  }
  if config.Claims[1].References[0].Type != artifactPrisma {
    t.Fatalf("a Prisma reference must decode as one, got %q", config.Claims[1].References[0].Type)
  }
}

func decodePrismaConfig(t *testing.T, raw string) (graphConfig, []string) {
  t.Helper()
  return decodeGraphConfig([]byte(raw))
}
