package evidence

import (
  "testing"
)

/**
 * Verifies the unsupported-artifact message lists Prisma on both sides.
 *
 * Most users meet a configuration surface through the error that rejects their
 * first attempt, so a message that omits a supported kind is how a feature
 * stays unused. Swagger remains evidence-only, and its own message has to stay
 * accurate about what a claim may be.
 *
 *  1. Name an unsupported kind as a claim and as a reference.
 *  2. Assert both messages list Prisma among the supported kinds.
 *  3. Assert the Swagger-as-claim message lists it too.
 *
 * @evidence contracts/testing.md#behavioral-verification decodePrismaConfig lists Prisma in unsupported claim/reference messages and rejects Swagger claims.
 * @evidence contracts/testing.md#independent-expectations Literal supported-kind diagnostic lists are the public contract.
 * @evidence contracts/testing.md#distinguishing-cases Claim and reference allowed kinds differ.
 * @evidence contracts/testing.md#execution-ownership TestPrismaConfigurationIsOfferedInDiagnostics is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaConfigurationIsOfferedInDiagnostics(t *testing.T) {
  _, claim := decodePrismaConfig(t, `{"claims":[{
    "type":"graphql",
    "files":["schema.graphql"],
    "reference":{"type":"markdown","files":["docs/**"]}
  }]}`)
  assertProblemContains(t, claim, "expected 'markdown', 'prisma', or 'typescript'")

  _, reference := decodePrismaConfig(t, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "reference":{"type":"graphql","files":["schema.graphql"]}
  }]}`)
  assertProblemContains(t, reference, "expected 'markdown', 'prisma', 'swagger', or 'typescript'")

  _, swagger := decodePrismaConfig(t, `{"claims":[{
    "type":"swagger",
    "files":["swagger.json"],
    "reference":{"type":"markdown","files":["docs/**"]}
  }]}`)
  assertProblemContains(t, swagger, "expected 'markdown', 'prisma', or 'typescript'")
}
