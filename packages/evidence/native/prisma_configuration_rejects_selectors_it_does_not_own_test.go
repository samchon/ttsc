package evidence

import (
  "testing"
)

/**
 * Verifies the Swagger-only and TypeScript-only selectors stay Swagger-only and
 * TypeScript-only.
 *
 * A Prisma schema folder is several files forming one namespace, so it takes
 * `files` globs like Markdown rather than Swagger's singular `file`; and it
 * lives in this project, so it cannot select an installed package. Accepting
 * either quietly would select nothing while reading as a configured
 * population.
 *
 *  1. Configure a Prisma reference with `file`, then with `package`.
 *  2. Assert each is rejected with the message that owns it.
 *
 * @evidence contracts/testing.md#behavioral-verification decodePrismaConfig rejects singular file and installed package with separate messages.
 * @evidence contracts/testing.md#independent-expectations Prisma uses files populations; file belongs to Swagger and package to TypeScript.
 * @evidence contracts/testing.md#distinguishing-cases Two invalid locator channels retain distinct repairs.
 * @evidence contracts/testing.md#execution-ownership TestPrismaConfigurationRejectsSelectorsItDoesNotOwn is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaConfigurationRejectsSelectorsItDoesNotOwn(t *testing.T) {
  _, singular := decodePrismaConfig(t, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "reference":{"type":"prisma","file":"prisma/schema.prisma"}
  }]}`)
  assertProblemContains(t, singular, "singular 'file' is only supported by Swagger references")

  _, packaged := decodePrismaConfig(t, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "reference":{"type":"prisma","package":"@scope/name","files":["prisma/**"]}
  }]}`)
  assertProblemContains(t, packaged, "only a TypeScript reference can select an installed package")
}
